import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, ChevronDown, ChevronUp, Loader2, AlertTriangle, Phone, Camera, MessageSquare } from 'lucide-react';
import { useScreeningConfig, CatalogQuestion } from '@/hooks/useScreeningConfig';
import { toast } from '@/hooks/use-toast';

export function ScreeningConfigCard() {
  const {
    config,
    questions,
    loading,
    error,
    updateConfig,
    toggleQuestion,
    setAutoDeclineRule,
    getAutoDeclineRules,
  } = useScreeningConfig();

  const [expandedQuestions, setExpandedQuestions] = useState(false);
  const [saving, setSaving] = useState(false);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !config) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="py-8 text-center text-destructive">
          <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
          <p>{error || 'Failed to load screening config'}</p>
        </CardContent>
      </Card>
    );
  }

  const enabledQuestionIds = (config.enabled_questions as string[]) || [];
  const autoDeclineRules = getAutoDeclineRules();

  const handleToggle = async (field: string, value: boolean) => {
    setSaving(true);
    const result = await updateConfig({ [field]: value });
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleToggleQuestion = async (questionId: string) => {
    setSaving(true);
    const result = await toggleQuestion(questionId);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleAutoDeclineToggle = async (question: CatalogQuestion, answer: string, checked: boolean) => {
    const currentRules = autoDeclineRules[question.id] || [];
    let newRules: string[];

    if (checked) {
      newRules = [...currentRules, answer];
    } else {
      newRules = currentRules.filter((a) => a !== answer);
    }

    setSaving(true);
    const result = await setAutoDeclineRule(question.id, newRules);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Screening Configuration
          {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
        </CardTitle>
        <CardDescription>
          Control what information you collect and auto-decline rules
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Verification Requirements */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">Verification Requirements</h3>
          
          <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="require-phone" className="text-sm font-medium">Require phone number</Label>
                <p className="text-xs text-muted-foreground">Invitees must provide a phone number</p>
              </div>
            </div>
            <Switch
              id="require-phone"
              checked={config.require_phone ?? true}
              onCheckedChange={(v) => handleToggle('require_phone', v)}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
            <div className="flex items-center gap-3">
              <Camera className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="require-selfie" className="text-sm font-medium">Require selfie</Label>
                <p className="text-xs text-muted-foreground">Invitees must upload a photo</p>
              </div>
            </div>
            <Switch
              id="require-selfie"
              checked={config.require_selfie ?? false}
              onCheckedChange={(v) => handleToggle('require_selfie', v)}
            />
          </div>
        </div>

        {/* Require Instagram */}
        <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 text-muted-foreground">📸</div>
            <div>
              <Label htmlFor="require-instagram" className="text-sm font-medium">Require Instagram</Label>
              <p className="text-xs text-muted-foreground">Invitees must provide an Instagram handle</p>
            </div>
          </div>
          <Switch
            id="require-instagram"
            checked={(config as any).require_instagram ?? false}
            onCheckedChange={(v) => handleToggle('require_instagram', v)}
          />
        </div>

        {/* Require Telegram */}
        <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 text-muted-foreground">✈️</div>
            <div>
              <Label htmlFor="require-telegram" className="text-sm font-medium">Require Telegram</Label>
              <p className="text-xs text-muted-foreground">Invitees must provide a Telegram username</p>
            </div>
          </div>
          <Switch
            id="require-telegram"
            checked={(config as any).require_telegram ?? false}
            onCheckedChange={(v) => handleToggle('require_telegram', v)}
          />
        </div>

        {/* Invitee Note */}
        <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label htmlFor="allow-note" className="text-sm font-medium">Allow personal note</Label>
              <p className="text-xs text-muted-foreground">Let invitees write a message to you</p>
            </div>
          </div>
          <Switch
            id="allow-note"
            checked={config.allow_invitee_note ?? true}
            onCheckedChange={(v) => handleToggle('allow_invitee_note', v)}
          />
        </div>

        {/* Screening Questions */}
        <Collapsible open={expandedQuestions} onOpenChange={setExpandedQuestions}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground">Screening Questions</h3>
              <p className="text-xs text-muted-foreground">
                {enabledQuestionIds.length} of {questions.length} enabled
              </p>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {expandedQuestions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {expandedQuestions ? 'Collapse' : 'Expand'}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="mt-4 space-y-3">
            {questions.map((question) => {
              const isEnabled = enabledQuestionIds.includes(question.id);
              const answers = question.answers_json as string[] | null;
              const questionAutoDecline = autoDeclineRules[question.id] || [];

              return (
                <div key={question.id} className="border border-border rounded-lg p-3 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Label className="text-sm font-medium">{question.label}</Label>
                        {question.auto_decline_supported && (
                          <Badge variant="secondary" className="text-xs">
                            auto-decline
                          </Badge>
                        )}
                      </div>
                      {/* Show answer options preview */}
                      {answers && answers.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {answers.map((answer) => (
                            <Badge key={answer} variant="outline" className="text-xs font-normal">
                              {answer}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {question.type === 'boolean' && (
                        <div className="flex gap-1 mt-2">
                          <Badge variant="outline" className="text-xs font-normal">Yes</Badge>
                          <Badge variant="outline" className="text-xs font-normal">No</Badge>
                        </div>
                      )}
                      {question.type === 'text' && (
                        <p className="text-xs text-muted-foreground mt-1">Free text answer</p>
                      )}
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => handleToggleQuestion(question.id)}
                    />
                  </div>

                  {/* Auto-decline options for enabled questions with answers */}
                  {isEnabled && question.auto_decline_supported && answers && answers.length > 0 && (
                    <div className="pl-4 border-l-2 border-destructive/30 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Auto-decline if answer is:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {answers.map((answer) => (
                          <div key={answer} className="flex items-center gap-1.5">
                            <Checkbox
                              id={`${question.id}-${answer}`}
                              checked={questionAutoDecline.includes(answer)}
                              onCheckedChange={(checked) => 
                                handleAutoDeclineToggle(question, answer, checked === true)
                              }
                            />
                            <Label 
                              htmlFor={`${question.id}-${answer}`}
                              className="text-xs cursor-pointer"
                            >
                              {answer}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
