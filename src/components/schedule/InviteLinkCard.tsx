import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Link2, Plus, Copy, Check, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { useInviteLinks } from '@/hooks/useInviteLinks';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface InviteLinkCardProps {
  scheduleId: string | null;
}

export function InviteLinkCard({ scheduleId }: InviteLinkCardProps) {
  const { links, loading, createLink, revokeLink, getInviteUrl } = useInviteLinks(scheduleId);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    const result = await createLink('public');
    setCreating(false);

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Invite link created' });
    }
  };

  const handleCopy = async (token: string, id: string) => {
    const url = getInviteUrl(token);
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast({ title: 'Link copied to clipboard' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async (id: string) => {
    const result = await revokeLink(id);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Link revoked' });
    }
  };

  const activeLinks = links.filter((link) => !link.used_at && (!link.expires_at || new Date(link.expires_at) > new Date()));
  const inactiveLinks = links.filter((link) => link.used_at || (link.expires_at && new Date(link.expires_at) <= new Date()));

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Invite Links
            </CardTitle>
            <CardDescription>
              Share your invite link so others can request dates with you
            </CardDescription>
          </div>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            New Link
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeLinks.length === 0 && inactiveLinks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="mb-4">No invite links yet</p>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Your First Link
            </Button>
          </div>
        ) : (
          <>
            {activeLinks.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Active Links</h3>
                {activeLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">
                          {link.type}
                        </Badge>
                        {link.expires_at && (
                          <span className="text-xs text-muted-foreground">
                            Expires {format(new Date(link.expires_at), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                      <Input
                        readOnly
                        value={getInviteUrl(link.token)}
                        className="text-sm bg-muted/50"
                      />
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(link.token, link.id)}
                      >
                        {copiedId === link.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                      >
                        <a href={getInviteUrl(link.token)} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRevoke(link.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {inactiveLinks.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Revoked / Expired</h3>
                {inactiveLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 opacity-60"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {link.used_at ? 'Revoked' : 'Expired'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Created {format(new Date(link.created_at!), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        .../{link.token.slice(-8)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
