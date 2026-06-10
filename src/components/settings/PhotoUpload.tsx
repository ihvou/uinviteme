import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type ProfilePhoto = Tables<"profile_photos">;

interface PhotoUploadProps {
  userId: string;
  currentPhotoUrl?: string | null;
  displayName?: string | null;
  profilePhotos: ProfilePhoto[];
  onPhotosUpdated: (photos: ProfilePhoto[], primaryUrl: string | null) => void;
}

const MAX_PHOTOS = 4;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function PhotoUpload({
  userId,
  currentPhotoUrl,
  displayName,
  profilePhotos,
  onPhotosUpdated,
}: PhotoUploadProps) {
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sortedPhotos = useMemo(
    () => [...profilePhotos].sort((a, b) => a.sort_order - b.sort_order),
    [profilePhotos],
  );
  const remainingSlots = Math.max(0, MAX_PHOTOS - sortedPhotos.length);

  const photoUrlFor = (storagePath: string) =>
    supabase.storage.from("avatars").getPublicUrl(storagePath).data.publicUrl;

  const legacyPhoto = sortedPhotos.length === 0 && currentPhotoUrl
    ? currentPhotoUrl
    : null;

  const refreshPhotos = async () => {
    const { data, error } = await supabase
      .from("profile_photos")
      .select("*")
      .eq("profile_id", userId)
      .order("sort_order");

    if (error) throw error;

    const photos = data || [];
    const primaryUrl = photos[0] ? photoUrlFor(photos[0].storage_path) : null;
    onPhotosUpdated(photos, primaryUrl);
    return photos;
  };

  const updatePrimaryPhoto = async (photos: ProfilePhoto[]) => {
    const primaryUrl = photos[0] ? photoUrlFor(photos[0].storage_path) : null;
    const { error } = await supabase
      .from("profiles")
      .update({ photo_url: primaryUrl })
      .eq("id", userId);

    if (error) throw error;
    onPhotosUpdated(photos, primaryUrl);
  };

  const reorderPhotos = async (orderedPhotos: ProfilePhoto[]) => {
    for (const [index, photo] of orderedPhotos.entries()) {
      const { error } = await supabase
        .from("profile_photos")
        .update({ sort_order: 1000 + index })
        .eq("id", photo.id);
      if (error) throw error;
    }

    for (const [index, photo] of orderedPhotos.entries()) {
      const { error } = await supabase
        .from("profile_photos")
        .update({ sort_order: index })
        .eq("id", photo.id);
      if (error) throw error;
    }

    const photos = await refreshPhotos();
    await updatePrimaryPhoto(photos);
  };

  const validateFiles = (files: File[]) => {
    if (files.length > remainingSlots) {
      toast({
        variant: "destructive",
        title: "Too many photos",
        description: `You can add ${remainingSlots} more.`,
      });
      return false;
    }

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast({
          variant: "destructive",
          title: "Invalid file",
          description: "Please upload image files.",
        });
        return false;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: "Maximum file size is 5MB.",
        });
        return false;
      }
    }

    return true;
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || !validateFiles(files)) return;

    setBusy(true);
    try {
      const currentMaxOrder = sortedPhotos.reduce(
        (max, photo) => Math.max(max, photo.sort_order),
        -1,
      );

      for (const [index, file] of files.entries()) {
        const sortOrder = currentMaxOrder + index + 1;
        const extension = file.name.split(".").pop() || "jpg";
        const storagePath = `${userId}/${sortOrder + 1}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase
          .from("profile_photos")
          .insert({
            profile_id: userId,
            storage_path: storagePath,
            sort_order: sortOrder,
          });

        if (insertError) throw insertError;
      }

      const photos = await refreshPhotos();
      await updatePrimaryPhoto(photos);
      toast({ title: "Photos saved" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Could not upload photos.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (photo: ProfilePhoto) => {
    setBusy(true);
    try {
      await supabase.storage.from("avatars").remove([photo.storage_path]);

      const { error } = await supabase
        .from("profile_photos")
        .delete()
        .eq("id", photo.id);

      if (error) throw error;

      const nextPhotos = sortedPhotos.filter((item) => item.id !== photo.id);
      await reorderPhotos(nextPhotos);
      toast({ title: "Photo removed" });
    } catch (error) {
      console.error("Remove error:", error);
      toast({
        variant: "destructive",
        title: "Failed to remove photo",
        description: "Could not remove this photo.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveLegacyPhoto = async () => {
    setBusy(true);
    try {
      await supabase.storage
        .from("avatars")
        .remove([
          `${userId}/avatar.jpg`,
          `${userId}/avatar.png`,
          `${userId}/avatar.webp`,
        ]);

      const { error } = await supabase
        .from("profiles")
        .update({ photo_url: null })
        .eq("id", userId);

      if (error) throw error;

      onPhotosUpdated([], null);
      toast({ title: "Photo removed" });
    } catch (error) {
      console.error("Remove error:", error);
      toast({
        variant: "destructive",
        title: "Failed to remove photo",
        description: "Could not remove this photo.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleMakePrimary = async (photo: ProfilePhoto) => {
    if (sortedPhotos[0]?.id === photo.id) return;

    setBusy(true);
    try {
      await reorderPhotos([
        photo,
        ...sortedPhotos.filter((item) => item.id !== photo.id),
      ]);
      toast({ title: "Main photo updated" });
    } catch (error) {
      console.error("Primary photo error:", error);
      toast({
        variant: "destructive",
        title: "Could not update main photo",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {sortedPhotos.map((photo, index) => {
          const publicUrl = photoUrlFor(photo.storage_path);
          const isPrimary = index === 0;

          return (
            <div
              key={photo.id}
              className="group relative aspect-[4/5] overflow-hidden rounded-lg border border-border bg-muted"
            >
              <img
                src={publicUrl}
                alt={displayName ? `${displayName} photo ${index + 1}` : `Profile photo ${index + 1}`}
                className="h-full w-full object-cover"
              />
              {isPrimary && (
                <Badge className="absolute left-2 top-2 bg-background/90 text-foreground hover:bg-background/90">
                  Main
                </Badge>
              )}
              <div className="absolute inset-x-2 bottom-2 flex gap-2">
                {!isPrimary && (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    onClick={() => handleMakePrimary(photo)}
                    disabled={busy}
                    aria-label="Set as main photo"
                    className="h-8 w-8 bg-background/90 hover:bg-background"
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  onClick={() => handleRemove(photo)}
                  disabled={busy}
                  aria-label="Remove photo"
                  className="ml-auto h-8 w-8 bg-background/90 text-destructive hover:bg-background"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}

        {legacyPhoto && (
          <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-border bg-muted">
            <img
              src={legacyPhoto}
              alt={displayName ? `${displayName} photo` : "Profile photo"}
              className="h-full w-full object-cover"
            />
            <Badge className="absolute left-2 top-2 bg-background/90 text-foreground hover:bg-background/90">
              Main
            </Badge>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={handleRemoveLegacyPhoto}
              disabled={busy}
              aria-label="Remove photo"
              className="absolute bottom-2 right-2 h-8 w-8 bg-background/90 text-destructive hover:bg-background"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {remainingSlots > 0 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy || !userId}
            className="flex aspect-[4/5] items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-muted-foreground transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Add photos"
          >
            {busy ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <ImagePlus className="h-6 w-6" />
            )}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleUpload}
        disabled={busy}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy || remainingSlots === 0}
        className="gap-2"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        Add photos
      </Button>
    </div>
  );
}
