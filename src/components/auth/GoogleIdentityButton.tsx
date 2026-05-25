import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GoogleIdentityButtonProps {
  disabled?: boolean;
  loading?: boolean;
  onCredential: (credential: string, nonce: string) => void | Promise<void>;
  onError?: (message: string) => void;
}

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    nonce: string;
    use_fedcm_for_prompt?: boolean;
  }) => void;
  renderButton: (
    element: HTMLElement,
    options: {
      theme: 'outline';
      size: 'large';
      type: 'standard';
      shape: 'rectangular';
      text: 'continue_with';
      width: number;
    },
  ) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

let googleScriptPromise: Promise<void> | null = null;

export function GoogleIdentityButton({
  disabled,
  loading,
  onCredential,
  onError,
}: GoogleIdentityButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  useEffect(() => {
    if (!clientId || disabled) return;

    let canceled = false;

    async function renderGoogleButton() {
      try {
        setScriptError(false);
        setScriptReady(false);

        const rawNonce = createNonce();
        const hashedNonce = await sha256Hex(rawNonce);

        await loadGoogleScript();
        if (canceled || !buttonRef.current || !window.google?.accounts?.id) {
          return;
        }

        buttonRef.current.innerHTML = '';
        window.google.accounts.id.initialize({
          client_id: clientId,
          nonce: hashedNonce,
          use_fedcm_for_prompt: true,
          callback: (response) => {
            if (!response.credential) {
              onError?.('Google did not return a sign-in credential.');
              return;
            }

            void onCredential(response.credential, rawNonce);
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text: 'continue_with',
          width: Math.min(buttonRef.current.offsetWidth || 400, 400),
        });
        setScriptReady(true);
      } catch (error) {
        setScriptError(true);
        onError?.(
          error instanceof Error
            ? error.message
            : 'Could not load Google sign in.',
        );
      }
    }

    void renderGoogleButton();

    return () => {
      canceled = true;
    };
  }, [clientId, disabled, onCredential, onError]);

  if (!clientId) {
    return (
      <Button type="button" variant="outline" className="w-full" disabled>
        Google sign in is not configured
      </Button>
    );
  }

  if (disabled || loading || scriptError) {
    return (
      <Button type="button" variant="outline" className="w-full" disabled>
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Continue with Google
      </Button>
    );
  }

  return (
    <div className="relative min-h-10 w-full">
      {!scriptReady && (
        <Button type="button" variant="outline" className="w-full" disabled>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading Google
        </Button>
      )}
      <div
        ref={buttonRef}
        className={scriptReady ? 'flex w-full justify-center' : 'invisible absolute inset-0'}
      />
    </div>
  );
}

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Could not load Google sign in.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Google sign in.'));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

function createNonce() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
