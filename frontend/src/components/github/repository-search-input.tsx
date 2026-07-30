import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';

interface RepositorySearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RepositorySearchInput({
  value,
  onChange,
  placeholder = 'Search repositories or branches...',
  className = '',
}: RepositorySearchInputProps) {
  return (
    <div className={`relative ${className}`.trim()}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 bg-card/50 border-border/50"
      />
    </div>
  );
}
