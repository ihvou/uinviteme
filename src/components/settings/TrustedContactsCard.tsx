import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Phone, Plus, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type TrustedContact = Tables<"trusted_contacts">;

interface DraftContact {
  id?: string;
  label: string;
  phone_e164: string;
}

const EMPTY_CONTACT: DraftContact = {
  label: "",
  phone_e164: "",
};

const E164_PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

export function TrustedContactsCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<DraftContact[]>([]);
  const [initialIds, setInitialIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadContacts = useCallback(async () => {
    if (!user) {
      setContacts([]);
      setInitialIds(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("trusted_contacts")
      .select("id,label,phone_e164")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    setLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Could not load trusted contacts",
        description: error.message,
      });
      return;
    }

    const loaded = (data || []).map((contact: Pick<TrustedContact, "id" | "label" | "phone_e164">) => ({
      id: contact.id,
      label: contact.label || "",
      phone_e164: contact.phone_e164,
    }));
    setContacts(loaded);
    setInitialIds(new Set(loaded.map((contact) => contact.id).filter(Boolean) as string[]));
  }, [toast, user]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const normalizedContacts = useMemo(
    () =>
      contacts
        .map((contact) => ({
          ...contact,
          label: contact.label.trim(),
          phone_e164: contact.phone_e164.trim().replace(/\s+/g, ""),
        }))
        .filter((contact) => contact.label || contact.phone_e164),
    [contacts],
  );

  const handleContactChange = (
    index: number,
    field: keyof DraftContact,
    value: string,
  ) => {
    setContacts((current) =>
      current.map((contact, contactIndex) =>
        contactIndex === index ? { ...contact, [field]: value } : contact
      )
    );
  };

  const handleAddContact = () => {
    setContacts((current) => [...current, { ...EMPTY_CONTACT }]);
  };

  const handleRemoveContact = (index: number) => {
    setContacts((current) => current.filter((_, contactIndex) => contactIndex !== index));
  };

  const handleSave = async () => {
    if (!user) return;

    const invalid = normalizedContacts.find((contact) =>
      !E164_PHONE_REGEX.test(contact.phone_e164)
    );
    if (invalid) {
      toast({
        variant: "destructive",
        title: "Check phone number format",
        description: "Use international format like +971501234567.",
      });
      return;
    }

    const duplicates = new Set<string>();
    const duplicate = normalizedContacts.find((contact) => {
      if (duplicates.has(contact.phone_e164)) return true;
      duplicates.add(contact.phone_e164);
      return false;
    });
    if (duplicate) {
      toast({
        variant: "destructive",
        title: "Duplicate trusted contact",
        description: `${duplicate.phone_e164} is listed more than once.`,
      });
      return;
    }

    setSaving(true);

    const keptIds = new Set(normalizedContacts.map((contact) => contact.id).filter(Boolean) as string[]);
    const deletedIds = [...initialIds].filter((id) => !keptIds.has(id));

    for (const id of deletedIds) {
      const { error } = await supabase
        .from("trusted_contacts")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) {
        setSaving(false);
        toast({
          variant: "destructive",
          title: "Could not remove trusted contact",
          description: error.message,
        });
        return;
      }
    }

    for (const [index, contact] of normalizedContacts.entries()) {
      if (contact.id) {
        const { error } = await supabase
          .from("trusted_contacts")
          .update({
            label: contact.label || null,
            phone_e164: contact.phone_e164,
            sort_order: index,
            is_active: true,
          })
          .eq("id", contact.id)
          .eq("user_id", user.id);
        if (error) {
          setSaving(false);
          toast({
            variant: "destructive",
            title: "Could not update trusted contact",
            description: error.message,
          });
          return;
        }
        continue;
      }

      const { error } = await supabase
        .from("trusted_contacts")
        .insert({
          user_id: user.id,
          label: contact.label || null,
          phone_e164: contact.phone_e164,
          sort_order: index,
          is_active: true,
        });
      if (error) {
        setSaving(false);
        toast({
          variant: "destructive",
          title: "Could not add trusted contact",
          description: error.message,
        });
        return;
      }
    }

    setSaving(false);
    toast({
      title: "Trusted contacts saved",
      description: "Safety Pack alerts will use this contact list.",
    });
    await loadContacts();
  };

  const rows = contacts.length > 0 ? contacts : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Trusted Contacts
        </CardTitle>
        <CardDescription>
          Emergency and missed check-in SMS alerts are sent to these numbers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading contacts
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
            Add at least one trusted contact before relying on Safety Pack SMS alerts.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((contact, index) => (
              <div
                key={contact.id || index}
                className="grid gap-3 sm:grid-cols-[1fr_1.2fr_auto] sm:items-end"
              >
                <div className="space-y-2">
                  <Label htmlFor={`trusted-contact-label-${index}`}>
                    Name
                  </Label>
                  <Input
                    id={`trusted-contact-label-${index}`}
                    value={contact.label}
                    onChange={(event) =>
                      handleContactChange(index, "label", event.target.value)}
                    placeholder="Friend"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor={`trusted-contact-phone-${index}`}
                    className="flex items-center gap-2"
                  >
                    <Phone className="h-4 w-4" />
                    Phone
                  </Label>
                  <Input
                    id={`trusted-contact-phone-${index}`}
                    type="tel"
                    inputMode="tel"
                    value={contact.phone_e164}
                    onChange={(event) =>
                      handleContactChange(index, "phone_e164", event.target.value)}
                    placeholder="+971501234567"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  onClick={() => handleRemoveContact(index)}
                  aria-label="Remove trusted contact"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="outline" onClick={handleAddContact}>
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Trusted Contacts
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
