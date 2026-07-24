package database

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// Crypto handles AES-256-GCM encryption/decryption with a machine-local key.
// The key is stored in the OS-specific user config directory with restrictive
// file permissions (0600), ensuring cross-platform support:
//   - macOS:   ~/Library/Application Support/0x-excali/
//   - Linux:   ~/.config/0x-excali/
//   - Windows: %APPDATA%/0x-excali/
type Crypto struct {
	key []byte // 32-byte AES-256 key
}

const (
	keyFileName = ".keyfile"
	keySize     = 32 // AES-256
)

// NewCrypto initializes the encryption subsystem. It loads an existing key from
// the config directory, or generates a new one on first run.
func NewCrypto() (*Crypto, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return nil, fmt.Errorf("crypto: failed to get user config dir: %w", err)
	}

	appDir := filepath.Join(configDir, "0x-excali")
	if err := os.MkdirAll(appDir, 0700); err != nil {
		return nil, fmt.Errorf("crypto: failed to create app config dir: %w", err)
	}

	keyPath := filepath.Join(appDir, keyFileName)

	key, err := loadOrGenerateKey(keyPath)
	if err != nil {
		return nil, fmt.Errorf("crypto: key management failed: %w", err)
	}

	return &Crypto{key: key}, nil
}

// Encrypt encrypts plaintext using AES-256-GCM. Returns (ciphertext, nonce, error).
// Each call generates a fresh random nonce for semantic security.
func (c *Crypto) Encrypt(plaintext []byte) (ciphertext []byte, nonce []byte, err error) {
	block, err := aes.NewCipher(c.key)
	if err != nil {
		return nil, nil, fmt.Errorf("encrypt: failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, fmt.Errorf("encrypt: failed to create GCM: %w", err)
	}

	nonce = make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, fmt.Errorf("encrypt: failed to generate nonce: %w", err)
	}

	ciphertext = gcm.Seal(nil, nonce, plaintext, nil)
	return ciphertext, nonce, nil
}

// Decrypt decrypts ciphertext using AES-256-GCM with the provided nonce.
func (c *Crypto) Decrypt(ciphertext, nonce []byte) ([]byte, error) {
	block, err := aes.NewCipher(c.key)
	if err != nil {
		return nil, fmt.Errorf("decrypt: failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("decrypt: failed to create GCM: %w", err)
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypt: failed to decrypt (key may have changed): %w", err)
	}

	return plaintext, nil
}

// loadOrGenerateKey reads the key file if it exists, or generates a fresh
// 32-byte random key and writes it with 0600 permissions.
func loadOrGenerateKey(keyPath string) ([]byte, error) {
	// Try to read existing key
	if data, err := os.ReadFile(keyPath); err == nil {
		if len(data) == keySize {
			return data, nil
		}
		// Key file is corrupted or wrong size — regenerate
	}

	// Generate new key
	key := make([]byte, keySize)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return nil, fmt.Errorf("failed to generate random key: %w", err)
	}

	// Write with restrictive permissions (owner read/write only)
	if err := os.WriteFile(keyPath, key, 0600); err != nil {
		return nil, fmt.Errorf("failed to write key file: %w", err)
	}

	return key, nil
}
