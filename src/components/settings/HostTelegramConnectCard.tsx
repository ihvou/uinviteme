import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getFunctionErrorMessage } from "@/lib/functionError";
import { getTelegramStartUrl } from "@/lib/telegram";

interface HostTelegramConnectCardProps {
  description?: string;
  onLinkedStateChange?: (isLinked: boolean) => void;
}

interface TelegramConnection {
  id: string;
  is_active: boolean | null;
  telegram_username: string | null;
}

interface CreateTelegramLinkResponse {
  startPayload?: string;
}

export function HostTelegramConnectCard({
  description = "New invite requests will appear in Telegram with Accept and Decline buttons.",
  onLinkedStateChange,
}: HostTelegramConnectCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loadingConnection, setLoadingConnection] = useState(true);
  const [creatingTelegramLink, setCreatingTelegramLink] = useState(false);
  const [updatingTelegram, setUpdatingTelegram] = useState(false);
  const [telegramConnection, setTelegramConnection] =
    useState<TelegramConnection | null>(null);
  const [telegramLinkUrl, setTelegramLinkUrl] = useState<string | null>(null);

  const loadTelegramConnection = useCallback(async () => {
    if (!user) {
      setTelegramConnection(null);
      onLinkedStateChange?.(false);
      setLoadingConnection(false);
      return;
    }

    setLoadingConnection(true);

    const { data, error } = await supabase
      .from("telegram_connections")
      .select("id,is_active,telegram_username")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setLoadingConnection(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Could not load Telegram status",
        description: error.message,
      });
      onLinkedStateChange?.(false);
      return;
    }

    const connection = data as TelegramConnection | null;
    setTelegramConnection(connection);
    onLinkedStateChange?.(Boolean(connection));
  }, [onLinkedStateChange, toast, user]);

  useEffect(() => {
    void loadTelegramConnection();
  }, [loadTelegramConnection]);

  const handleCreateTelegramLink = async () => {
    setCreatingTelegramLink(true);
    setTelegramLinkUrl(null);

    const { data, error } = await supabase.functions.invoke<CreateTelegramLinkResponse>(
      "create-telegram-link",
      {
        body: {},
      },
    );

    setCreatingTelegramLink(false);

    if (error || !data?.startPayload) {
      toast({
        variant: "destructive",
        title: "Could not create Telegram link",
        description: error
          ? await getFunctionErrorMessage(error)
          : "Please try again.",
      });
      return;
    }

    const url = getTelegramStartUrl(data.startPayload);
    if (!url) {
      toast({
        variant: "destructive",
        title: "Telegram bot username missing",
        description: "Set VITE_TELEGRAM_BOT_USERNAME and redeploy the app.",
      });
      return;
    }

    setTelegramLinkUrl(url);
    toast({
      title: "Telegram link ready",
      description: "Open it within 15 minutes to link this account.",
    });
  };

  const handleToggleTelegram = async (enabled: boolean) => {
    if (!telegramConnection) {
      if (enabled) {
        await handleCreateTelegramLink();
      } else {
        setTelegramLinkUrl(null);
      }
      return;
    }

    setUpdatingTelegram(true);
    const { error } = await supabase.functions.invoke(
      "set-telegram-host-notifications",
      {
        body: { enabled },
      },
    );
    setUpdatingTelegram(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Could not update Telegram",
        description: await getFunctionErrorMessage(error),
      });
      return;
    }

    setTelegramConnection({
      ...telegramConnection,
      is_active: enabled,
    });
    setTelegramLinkUrl(null);
    onLinkedStateChange?.(true);
    toast({
      title: enabled ? "Telegram invites enabled" : "Telegram invites paused",
      description: enabled
        ? "New invite requests will be sent to your linked Telegram chat."
        : "New invite requests will stay in the web dashboard only.",
    });
  };

  const switchChecked = telegramConnection
    ? telegramConnection.is_active !== false
    : Boolean(telegramLinkUrl);
  const isBusy = loadingConnection || creatingTelegramLink || updatingTelegram;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="telegram-host-notifications"
              className="flex items-center gap-2 text-base font-semibold"
            >
              <Send className="h-4 w-4 text-primary" />
              Get invites directly to Telegram
            </Label>
            <p className="text-sm text-muted-foreground">{description}</p>
            {telegramConnection?.telegram_username && (
              <p className="text-xs text-muted-foreground">
                Linked to @{telegramConnection.telegram_username}
              </p>
            )}
          </div>
          <div className="flex min-h-9 items-center">
            {loadingConnection ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                id="telegram-host-notifications"
                checked={switchChecked}
                disabled={isBusy}
                onCheckedChange={handleToggleTelegram}
              />
            )}
          </div>
        </div>

        {telegramLinkUrl && !telegramConnection && (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Open Telegram to link this account. The link expires after 15
                minutes.
              </p>
              <a
                href={telegramLinkUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0"
              >
                <Button type="button" size="sm">
                  Open Telegram
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </a>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
