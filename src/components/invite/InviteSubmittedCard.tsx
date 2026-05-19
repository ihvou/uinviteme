import { Link } from 'react-router-dom';
import { Bell, CheckCircle2, Compass, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getTelegramStartUrl } from '@/lib/telegram';

interface InviteSubmittedCardProps {
  hostName?: string | null;
  hostHandle?: string | null;
  hostCity?: string | null;
  inviteId?: string | null;
}

function buildStartPayload(action: 'invite_updates' | 'discover', hostHandle?: string | null) {
  const normalizedHandle = hostHandle?.trim().replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32);

  return normalizedHandle ? `${action}_${normalizedHandle}` : action;
}

export function InviteSubmittedCard({ hostName, hostHandle, hostCity, inviteId }: InviteSubmittedCardProps) {
  const displayName = hostName || 'the host';
  const updatesUrl = getTelegramStartUrl(buildStartPayload('invite_updates', inviteId || hostHandle));
  const discoveryUrl = getTelegramStartUrl(buildStartPayload('discover', hostHandle));

  const renderTelegramButton = (
    href: string | null,
    label: string,
    icon: 'bell' | 'compass',
    variant: 'default' | 'outline',
  ) => {
    const Icon = icon === 'bell' ? Bell : Compass;
    const button = (
      <Button className="w-full" variant={variant} disabled={!href}>
        <Icon className="h-4 w-4 mr-2" />
        {label}
        {href && <ExternalLink className="h-3.5 w-3.5 ml-2" />}
      </Button>
    );

    if (!href) return button;

    return (
      <a href={href} target="_blank" rel="noreferrer" className="block">
        {button}
      </a>
    );
  };

  return (
    <Card>
      <CardContent className="p-8 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">
          Request Sent!
        </h1>
        <p className="text-muted-foreground mb-6">
          {displayName} will review your invite. Enable Telegram notifications to know when it is accepted.
        </p>

        <div className="space-y-3">
          {renderTelegramButton(updatesUrl, 'Enable Telegram notifications', 'bell', 'default')}
          {renderTelegramButton(discoveryUrl, hostCity ? `View profiles near ${hostCity}` : 'View profiles nearby', 'compass', 'outline')}

          {!updatesUrl && (
            <p className="text-xs text-muted-foreground">
              Telegram notifications are not available yet.
            </p>
          )}
        </div>

        <div className="mt-8 pt-6 border-t space-y-3">
          <p className="text-sm text-muted-foreground">
            Want your own invite page?
          </p>
          <Link to="/auth?mode=signup">
            <Button variant="secondary">Create Your Invite Page</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
