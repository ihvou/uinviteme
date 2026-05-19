-- Allow users to delete their own invite links
CREATE POLICY "Users can delete own invite links"
ON public.invite_links
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM schedules
    WHERE schedules.id = invite_links.schedule_id
    AND schedules.user_id = auth.uid()
  )
);