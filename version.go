package main

import (
	_ "embed"
	"strings"
)

//go:embed .version
var appVersionRaw string

// GetAppVersion returns the application version from the repository .version file.
func (a *App) GetAppVersion() string {
	return strings.TrimSpace(appVersionRaw)
}
