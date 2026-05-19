-- Grant insert permission on invitees table to anon role
GRANT INSERT ON public.invitees TO anon;

-- Grant insert permission on invites table to anon role  
GRANT INSERT ON public.invites TO anon;

-- Also need SELECT on invitees for the returning clause after insert
GRANT SELECT ON public.invitees TO anon;