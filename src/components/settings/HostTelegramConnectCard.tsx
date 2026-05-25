import { useState } from "react";
import { Bell, ExternalLink, Loader2, MessageSquare } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getFunctionErrorMessage } from "@/lib/functionError";
import { getTelegramStartUrl } from "@/lib/telegram";

interface HostTelegramConnectCardProps {
  description?: string;
}

export function HostTelegramConnectCard({
  description = "Connect Telegram to review invite requests from chat",
}: HostTelegramConnectCardProps) {
  const { toast } = useToast();
  const [creatingTelegramLink, setCreatingTelegramLink] = useState(false);
  const [telegramLinkUrl, setTelegramLinkUrl] = useState<string | null>(null);

  const handleCreateTelegramLink = async () => {
    setCreatingTelegramLink(true);
    setTelegramLinkUrl(null);

    const { data, error } = await supabase.functions.invoke(
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Telegram Notifications
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <MessageSquare className="h-4 w-4 mt-0.5 text-primary" />
            <p>
              Linked hosts receive new invite notifications in Telegram and can
              accept or decline with inline buttons.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleCreateTelegramLink}
            disabled={creatingTelegramLink}
          >
            {creatingTelegramLink && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Create Telegram link
          </Button>

          {telegramLinkUrl && (
            <a
              href={telegramLinkUrl}
              target="_blank"
              rel="noreferrer"
              className="sm:flex-1"
            >
              <Button type="button" className="w-full">
                Open Telegram
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </a>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          The link expires after 15 minutes and can only link this signed-in
          account.
        </p>
      </CardContent>
    </Card>
  );
}
