'use client';

import { useSession, signIn, signOut } from 'next-auth/react';

interface GoogleAuthStatusProps {
  compact?: boolean;
}

export function GoogleAuthStatus({ compact = false }: GoogleAuthStatusProps) {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-surface rounded-lg w-48" />
      </div>
    );
  }

  if (session?.accessToken) {
    // Connected state
    if (compact) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-green-400 text-sm">Google connected</span>
          <button
            onClick={() => signOut({ redirect: false })}
            className="text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            Disconnect
          </button>
        </div>
      );
    }

    return (
      <div className="p-4 bg-surface rounded-lg border border-green-500/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
            <span className="text-green-400 text-lg">G</span>
          </div>
          <div className="flex-1">
            <p className="text-text-primary font-display text-sm">Google Connected</p>
            <p className="text-text-muted text-xs">
              {session.user?.email || 'Authorized for Google Docs access'}
            </p>
          </div>
          <button
            onClick={() => signOut({ redirect: false })}
            className="px-3 py-1.5 text-sm text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
          >
            Disconnect
          </button>
        </div>
        {session.error === 'RefreshAccessTokenError' && (
          <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-400 text-xs">
              Session expired. Please reconnect your Google account.
            </p>
            <button
              onClick={() => signIn('google')}
              className="mt-2 text-xs text-accent-primary hover:underline"
            >
              Reconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  // Not connected state
  if (compact) {
    return (
      <button
        onClick={() => signIn('google')}
        className="text-sm text-accent-primary hover:underline"
      >
        Connect Google
      </button>
    );
  }

  return (
    <div className="p-4 bg-surface rounded-lg border border-surface">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-surface rounded-full flex items-center justify-center border border-text-muted/30">
          <span className="text-text-muted text-lg">G</span>
        </div>
        <div className="flex-1">
          <p className="text-text-primary font-display text-sm">Google Account</p>
          <p className="text-text-muted text-xs">
            Connect to view private Google Docs submissions
          </p>
        </div>
        <button
          onClick={() => signIn('google')}
          className="px-4 py-2 bg-accent-primary text-background rounded-lg text-sm font-display hover:bg-accent-primary/80 transition-colors"
        >
          Connect
        </button>
      </div>
    </div>
  );
}

export function GoogleAuthInlinePrompt({ url }: { url: string }) {
  return (
    <div className="p-4 bg-surface rounded-lg border border-accent-secondary/30">
      <p className="text-text-primary mb-3">
        This submission is a private Google Doc.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => signIn('google')}
          className="px-4 py-2 bg-accent-primary text-background rounded-lg text-sm font-display hover:bg-accent-primary/80 transition-colors"
        >
          Connect Google Account
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-primary hover:underline text-sm"
        >
          Or open manually
        </a>
      </div>
    </div>
  );
}
