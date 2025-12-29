import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Camera, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface PhotoUploadProps {
  userId: string;
  currentPhotoUrl?: string | null;
  displayName?: string | null;
  onPhotoUpdated: (url: string | null) => void;
}

export function PhotoUpload({ userId, currentPhotoUrl, displayName, onPhotoUpdated }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please upload an image file' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Maximum file size is 5MB' });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ photo_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      onPhotoUpdated(publicUrl);
      toast({ title: 'Photo updated', description: 'Your profile photo has been saved' });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ variant: 'destructive', title: 'Upload failed', description: 'Could not upload photo' });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setUploading(true);

    try {
      // Remove from storage
      await supabase.storage
        .from('avatars')
        .remove([`${userId}/avatar.jpg`, `${userId}/avatar.png`, `${userId}/avatar.webp`]);

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({ photo_url: null })
        .eq('id', userId);

      if (error) throw error;

      onPhotoUpdated(null);
      toast({ title: 'Photo removed' });
    } catch (error) {
      console.error('Remove error:', error);
      toast({ variant: 'destructive', title: 'Failed to remove photo' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar className="h-20 w-20">
          <AvatarImage src={currentPhotoUrl || undefined} alt={displayName || 'Profile'} />
          <AvatarFallback className="text-lg bg-primary/10 text-primary">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="gap-2"
        >
          <Camera className="h-4 w-4" />
          {currentPhotoUrl ? 'Change photo' : 'Upload photo'}
        </Button>
        {currentPhotoUrl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={uploading}
            className="gap-2 text-muted-foreground"
          >
            <X className="h-4 w-4" />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
