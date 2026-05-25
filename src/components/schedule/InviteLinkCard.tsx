import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Link2, Copy, Check, RefreshCw, Loader2, Globe, Clock, Zap, Calendar, ChevronDown } from 'lucide-react';
import { useInviteLinks, LinkType } from '@/hooks/useInviteLinks';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface InviteLinkCardProps {
  scheduleId: string | null;
  handle?: string | null;
  publicProfileEnabled?: boolean;
  onTogglePublicProfile?: (enabled: boolean) => void;
}

const LINK_ICONS: Record<LinkType, React.ElementType> = {
  one_time: Zap,
  exp_3d: Clock,
  exp_7d: Calendar,
};

const LINK_LABELS: Record<LinkType, string> = {
  one_time: 'One-time link',
  exp_3d: '3-day link',
  exp_7d: '7-day link',
};

const LINK_DESCRIPTIONS: Record<LinkType, string> = {
  one_time: 'Consumed after one successful invite',
  exp_3d: 'Valid for 3 days, multiple uses',
  exp_7d: 'Valid for 7 days, multiple uses',
};

export function InviteLinkCard({ 
  scheduleId, 
  handle, 
  publicProfileEnabled = true,
  onTogglePublicProfile 
}: InviteLinkCardProps) {
  const { links, loading, error, refreshLink, getInviteUrl, getPublicProfileUrl } = useInviteLinks(scheduleId);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<LinkType | null>(null);
  const [showOtherLinks, setShowOtherLinks] = useState(false);

  const handleCopy = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast({ title: 'Link copied to clipboard' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRefresh = async (linkType: LinkType) => {
    setRefreshing(linkType);
    const result = await refreshLink(linkType);
    setRefreshing(null);
    
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Link refreshed' });
    }
  };

  const renderLinkRow = (linkType: LinkType) => {
    const link = links[linkType];
    const Icon = LINK_ICONS[linkType];
    const url = link ? getInviteUrl(link.token) : '';
    const id = link?.id || linkType;
    
    return (
      <div key={linkType} className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{LINK_LABELS[linkType]}</span>
            {link?.expires_at && (
              <Badge variant="outline" className="text-xs">
                Expires {format(new Date(link.expires_at), 'MMM d')}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{LINK_DESCRIPTIONS[linkType]}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={url}
            className="text-sm bg-muted/50 font-mono"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCopy(url, id)}
            disabled={!link}
          >
            {copiedId === id ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleRefresh(linkType)}
            disabled={refreshing === linkType}
          >
            {refreshing === linkType ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const publicUrl = getPublicProfileUrl(handle);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Invite Links
        </CardTitle>
        <CardDescription>
          Share these links so others can request dates with you
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 7-day link as main */}
        {renderLinkRow('exp_7d')}

        {error && (
          <p className="text-xs text-destructive">
            Link generation needs attention: {error}
          </p>
        )}

        {/* Other links collapsed */}
        <Collapsible open={showOtherLinks} onOpenChange={setShowOtherLinks}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
              <span>Other link options</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showOtherLinks ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            {renderLinkRow('exp_3d')}
            {renderLinkRow('one_time')}
          </CollapsibleContent>
        </Collapsible>

        {/* Public profile toggle */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Public profile</span>
              <Badge variant={publicProfileEnabled ? 'default' : 'outline'} className="text-xs">
                {publicProfileEnabled ? 'ON' : 'OFF'}
              </Badge>
            </div>
            {onTogglePublicProfile && (
              <Switch
                checked={publicProfileEnabled}
                onCheckedChange={onTogglePublicProfile}
              />
            )}
          </div>
          {handle ? (
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={publicUrl || ''}
                className="text-sm bg-muted/50 font-mono"
                disabled={!publicProfileEnabled}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => publicUrl && handleCopy(publicUrl, 'public')}
                disabled={!publicProfileEnabled || !publicUrl}
              >
                {copiedId === 'public' ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Set a handle in Settings to enable public profile
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {publicProfileEnabled 
              ? 'Anyone can view your schedule at this URL' 
              : 'Enable to let anyone find you by handle'
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
