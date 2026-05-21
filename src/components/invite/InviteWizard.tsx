import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, ArrowRight, Check, Lock, User, MessageSquare, Send, ShieldCheck } from 'lucide-react';
import { SlotWithDate, ScreeningConfig, CatalogQuestion, CatalogFormat, CatalogVibeTag, CatalogIntentTag, CatalogBoundaryTag } from '@/hooks/usePublicInvite';
import { useToast } from '@/hooks/use-toast';

export interface InviteSubmitSuccess {
  inviteId?: string;
  inviteeId?: string;
  success?: boolean;
}

interface InviteWizardProps {
  slot: SlotWithDate;
  screeningConfig: ScreeningConfig | null;
  questions: CatalogQuestion[];
  formats: CatalogFormat[];
  vibeTags: CatalogVibeTag[];
  intentTags: CatalogIntentTag[];
  boundaryTags: CatalogBoundaryTag[];
  onSubmit: (data: {
    slotId: string;
    targetDate: string;
    inviteeData: {
      name: string;
      phone_e164?: string;
      phone_verified?: boolean;
      email?: string;
      instagram_handle?: string;
      telegram_username?: string;
    };
    answers: Record<string, unknown>;
    inviteeNote?: string;
  }) => Promise<{ error?: string; data?: InviteSubmitSuccess }>;
  onCancel: () => void;
  onSuccess: (data?: InviteSubmitSuccess) => void;
}

type Step = 'info' | 'questions' | 'note' | 'review';
const MOCK_SMS_CODE = '123456';

export function InviteWizard({
  slot,
  screeningConfig,
  questions,
  formats,
  vibeTags,
  intentTags,
  boundaryTags,
  onSubmit,
  onCancel,
  onSuccess,
}: InviteWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('info');
  const [submitting, setSubmitting] = useState(false);

  // Invitee info
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneVerificationSent, setPhoneVerificationSent] = useState(false);
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [telegram, setTelegram] = useState('');

  // Answers to screening questions
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  // Optional note
  const [note, setNote] = useState('');

  const enabledQuestionIds = (screeningConfig?.enabled_questions as string[]) || [];
  const enabledQuestions = questions.filter(q => enabledQuestionIds.includes(q.id));

  const formatLabel = formats.find(f => f.id === slot.format)?.label || '';
  const intentLabel = intentTags.find(t => t.id === slot.intent_tag)?.label || '';
  const vibeLabels = vibeTags.filter(t => slot.vibe_tags?.includes(t.id)).map(t => t.label);
  const boundaryLabels = boundaryTags.filter(t => slot.boundary_tags?.includes(t.id)).map(t => t.label);
  const trimmedPhone = phone.trim();
  const phoneNeedsVerification = Boolean(screeningConfig?.require_phone && trimmedPhone);
  const isPhoneVerified = phoneVerified && verifiedPhone === trimmedPhone;

  const timeBucketLabels: Record<string, string> = {
    morning: 'Morning (9 AM - 12 PM)',
    afternoon: 'Afternoon (12 - 5 PM)',
    early_evening: 'Early Evening (5 - 8 PM)',
    late_evening: 'Late Evening (8 PM+)',
  };

  const validateInfo = () => {
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return false;
    }
    if (screeningConfig?.require_phone && !phone.trim()) {
      toast({ title: 'Phone number is required', variant: 'destructive' });
      return false;
    }
    if (phoneNeedsVerification && !isPhoneVerified) {
      toast({ title: 'Verify your phone number first', variant: 'destructive' });
      return false;
    }
    if (screeningConfig?.require_instagram && !instagram.trim()) {
      toast({ title: 'Instagram handle is required', variant: 'destructive' });
      return false;
    }
    if (screeningConfig?.require_telegram && !telegram.trim()) {
      toast({ title: 'Telegram username is required', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 'info') {
      if (!validateInfo()) return;
      if (enabledQuestions.length > 0) {
        setStep('questions');
      } else if (screeningConfig?.allow_invitee_note) {
        setStep('note');
      } else {
        setStep('review');
      }
    } else if (step === 'questions') {
      if (screeningConfig?.allow_invitee_note) {
        setStep('note');
      } else {
        setStep('review');
      }
    } else if (step === 'note') {
      setStep('review');
    }
  };

  const handleBack = () => {
    if (step === 'questions') {
      setStep('info');
    } else if (step === 'note') {
      if (enabledQuestions.length > 0) {
        setStep('questions');
      } else {
        setStep('info');
      }
    } else if (step === 'review') {
      if (screeningConfig?.allow_invitee_note) {
        setStep('note');
      } else if (enabledQuestions.length > 0) {
        setStep('questions');
      } else {
        setStep('info');
      }
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const result = await onSubmit({
      slotId: slot.id,
      targetDate: slot.targetDate,
      inviteeData: {
        name: name.trim(),
        phone_e164: phone.trim() || undefined,
        phone_verified: isPhoneVerified,
        email: email.trim() || undefined,
        instagram_handle: instagram.trim() || undefined,
        telegram_username: telegram.trim() || undefined,
      },
      answers,
      inviteeNote: note.trim() || undefined,
    });
    setSubmitting(false);

    if (result.error) {
      toast({ title: 'Failed to submit', description: result.error, variant: 'destructive' });
    } else {
      onSuccess(result.data);
    }
  };

  const updateAnswer = (questionId: string, value: unknown) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    setPhoneCode('');
    setPhoneVerificationSent(false);
    setPhoneVerified(false);
    setVerifiedPhone('');
  };

  const handleSendPhoneCode = () => {
    if (!trimmedPhone) {
      toast({ title: 'Enter your phone number first', variant: 'destructive' });
      return;
    }

    setPhoneVerificationSent(true);
    setPhoneCode('');
    setPhoneVerified(false);
    setVerifiedPhone('');
    toast({
      title: 'Verification code sent',
      description: `Test code: ${MOCK_SMS_CODE}`,
    });
  };

  const handleVerifyPhoneCode = () => {
    if (phoneCode.trim() !== MOCK_SMS_CODE) {
      toast({ title: 'Invalid verification code', variant: 'destructive' });
      return;
    }

    setPhoneVerified(true);
    setVerifiedPhone(trimmedPhone);
    toast({ title: 'Phone verified' });
  };

  const renderQuestionInput = (question: CatalogQuestion) => {
    // answers_json can be a flat array of strings or an object with options key
    const answersJson = question.answers_json;
    let options: string[] = [];
    
    if (Array.isArray(answersJson)) {
      options = answersJson.filter((item): item is string => typeof item === 'string');
    } else if (answersJson && typeof answersJson === 'object' && 'options' in answersJson) {
      const rawOptions = (answersJson as { options?: unknown[] }).options;
      if (Array.isArray(rawOptions)) {
        options = rawOptions.filter((item): item is string => typeof item === 'string');
      }
    }
    
    if (question.type === 'boolean' || question.type === 'yes_no') {
      return (
        <RadioGroup
          value={answers[question.id] === true ? 'yes' : answers[question.id] === false ? 'no' : ''}
          onValueChange={(value) => updateAnswer(question.id, value === 'yes')}
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="yes" id={`${question.id}-yes`} />
            <Label htmlFor={`${question.id}-yes`} className="text-sm">Yes</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="no" id={`${question.id}-no`} />
            <Label htmlFor={`${question.id}-no`} className="text-sm">No</Label>
          </div>
        </RadioGroup>
      );
    }

    if (question.type === 'single_choice' && options.length > 0) {
      return (
        <RadioGroup
          value={answers[question.id] as string || ''}
          onValueChange={(value) => updateAnswer(question.id, value)}
        >
          {options.map((option) => (
            <div key={option} className="flex items-center gap-2">
              <RadioGroupItem value={option} id={`${question.id}-${option}`} />
              <Label htmlFor={`${question.id}-${option}`} className="text-sm">{option}</Label>
            </div>
          ))}
        </RadioGroup>
      );
    }

    if (question.type === 'multi_choice' && options.length > 0) {
      const selected = (answers[question.id] as string[]) || [];
      return (
        <div className="space-y-2">
          {options.map((option) => (
            <div key={option} className="flex items-center gap-2">
              <Checkbox
                id={`${question.id}-${option}`}
                checked={selected.includes(option)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    updateAnswer(question.id, [...selected, option]);
                  } else {
                    updateAnswer(question.id, selected.filter(s => s !== option));
                  }
                }}
              />
              <Label htmlFor={`${question.id}-${option}`} className="text-sm">{option}</Label>
            </div>
          ))}
        </div>
      );
    }

    if (question.type === 'number') {
      return (
        <Input
          type="number"
          value={(answers[question.id] as string) || ''}
          onChange={(e) => updateAnswer(question.id, e.target.value)}
          placeholder="Enter a number..."
        />
      );
    }

    return (
      <Input
        value={(answers[question.id] as string) || ''}
        onChange={(e) => updateAnswer(question.id, e.target.value)}
        placeholder="Your answer..."
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Slot Summary */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">
                {slot.dayLabel} · {timeBucketLabels[slot.time_bucket] || slot.time_bucket}
              </p>
              <p className="text-sm text-muted-foreground">
                {slot.area_label} · {formatLabel}
              </p>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary">
              {slot.targetDate}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Step: Info */}
      {step === 'info' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" />
              About You
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            {screeningConfig?.require_phone && (
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      type="button"
                      variant={phoneVerificationSent ? 'outline' : 'secondary'}
                      onClick={handleSendPhoneCode}
                      disabled={!trimmedPhone || isPhoneVerified}
                    >
                      {phoneVerificationSent ? 'Resend code' : 'Send code'}
                    </Button>
                    <div className="flex flex-1 gap-2">
                      <Input
                        value={phoneCode}
                        onChange={(e) => setPhoneCode(e.target.value)}
                        placeholder="6-digit code"
                        inputMode="numeric"
                        disabled={!phoneVerificationSent || isPhoneVerified}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleVerifyPhoneCode}
                        disabled={!phoneVerificationSent || isPhoneVerified}
                      >
                        Verify
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {isPhoneVerified ? (
                      <>
                        <ShieldCheck className="h-3 w-3 text-primary" />
                        <span>Phone verified</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-3 w-3" />
                        <span>Test SMS code: {MOCK_SMS_CODE}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            {(screeningConfig?.allow_instagram || screeningConfig?.require_instagram) && (
              <div className="space-y-2">
                <Label htmlFor="instagram">
                  Instagram Handle {screeningConfig?.require_instagram ? '*' : '(optional)'}
                </Label>
                <Input
                  id="instagram"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@yourhandle"
                />
              </div>
            )}

            {(screeningConfig?.allow_telegram || screeningConfig?.require_telegram) && (
              <div className="space-y-2">
                <Label htmlFor="telegram">
                  Telegram Username {screeningConfig?.require_telegram ? '*' : '(optional)'}
                </Label>
                <Input
                  id="telegram"
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  placeholder="@yourhandle"
                />
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
              <Lock className="h-3 w-3" />
              <span>Your info is only shared with the host if they accept.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Questions */}
      {step === 'questions' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5" />
              Screening Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {enabledQuestions.map((question) => (
              <div key={question.id} className="space-y-2">
                <Label>{question.label}</Label>
                {renderQuestionInput(question)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Step: Note */}
      {step === 'note' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5" />
              Add a Note (Optional)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything you'd like the host to know? Maybe where you matched, or a conversation starter..."
              rows={4}
            />
          </CardContent>
        </Card>
      )}

      {/* Step: Review */}
      {step === 'review' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Check className="h-5 w-5" />
              Review Your Request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{name}</p>
            </div>
            {phone && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{phone} {isPhoneVerified && '· verified'}</p>
              </div>
            )}
            {email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{email}</p>
              </div>
            )}
            {(instagram || telegram) && (
              <div>
                <p className="text-sm text-muted-foreground">Social</p>
                <p className="font-medium">
                  {instagram && `IG: ${instagram}`}
                  {instagram && telegram && ' · '}
                  {telegram && `TG: ${telegram}`}
                </p>
              </div>
            )}
            {note && (
              <div>
                <p className="text-sm text-muted-foreground">Note</p>
                <p className="font-medium">{note}</p>
              </div>
            )}

            <div className="pt-4 border-t">
              <div className="flex flex-wrap gap-1">
                {intentLabel && (
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    {intentLabel}
                  </Badge>
                )}
                {vibeLabels.map((label) => (
                  <Badge key={label} variant="secondary">{label}</Badge>
                ))}
                {boundaryLabels.map((label) => (
                  <Badge key={label} variant="outline" className="border-destructive/30 text-destructive">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              By submitting, you're expressing interest. The host will review and decide whether to confirm.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="ghost"
          onClick={step === 'info' ? onCancel : handleBack}
          disabled={submitting}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {step === 'info' ? 'Cancel' : 'Back'}
        </Button>

        {step !== 'review' ? (
          <Button onClick={handleNext}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting}>
            <Send className="h-4 w-4 mr-2" />
            {submitting ? 'Submitting...' : 'Send Invite Request'}
          </Button>
        )}
      </div>
    </div>
  );
}
