import { useState } from 'react';

import { Globe, Loader2, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { GitHubRepository } from '@/types/github';

interface CreateRepositoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (repo: GitHubRepository) => void | Promise<void>;
}

export function CreateRepositoryDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateRepositoryDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setName('');
    setDescription('');
    setIsPrivate(true);
    setError('');
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError('');

    try {
      const { CreateGitHubRepository } = await import('../../../wailsjs/go/workspace/Service');
      const repo = await CreateGitHubRepository(name.trim(), description.trim(), isPrivate);
      onOpenChange(false);
      reset();
      await onCreated(repo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create repository');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!creating) {
          onOpenChange(next);
          if (!next) reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Repository</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Repository name
            </label>
            <Input
              placeholder="my-diagrams-workspace"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              placeholder="My visual workspace"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant={isPrivate ? 'default' : 'outline'}
              size="sm"
              className="gap-2"
              onClick={() => setIsPrivate(true)}
            >
              <Lock className="h-3.5 w-3.5" />
              Private
            </Button>
            <Button
              variant={!isPrivate ? 'default' : 'outline'}
              size="sm"
              className="gap-2"
              onClick={() => setIsPrivate(false)}
            >
              <Globe className="h-3.5 w-3.5" />
              Public
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || creating} className="gap-2">
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            Create & Select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
