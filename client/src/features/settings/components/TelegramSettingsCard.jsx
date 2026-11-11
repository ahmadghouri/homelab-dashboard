import { LoaderCircleIcon, SearchIcon, SendIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  useFindTelegramChats,
  useSendTelegramTest,
  useUpdateSettings,
} from '../hooks/useSettings';

function SetupSteps() {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-4 text-sm">
      <p className="font-medium">Telegram is not set up yet</p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground">
        <li>
          In Telegram, open <span className="font-mono">@BotFather</span>, send{' '}
          <span className="font-mono">/newbot</span>, and follow the steps.
        </li>
        <li>
          Copy the bot token into <span className="font-mono">server/.env</span> as{' '}
          <span className="font-mono">TELEGRAM_BOT_TOKEN=...</span>
        </li>
        <li>Restart the server, then come back to this page.</li>
      </ol>
    </div>
  );
}

function ChatFinder({ onPick }) {
  const findChats = useFindTelegramChats();

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        disabled={findChats.isPending}
        onClick={() =>
          findChats.mutate(undefined, {
            onSuccess: (chats) => {
              if (chats.length === 0) {
                toast.info('No chats found. Send /start to your bot in Telegram, then try again.');
              }
            },
            onError: (error) => toast.error(error.message),
          })
        }
      >
        {findChats.isPending ? <LoaderCircleIcon className="animate-spin" aria-hidden="true" /> : <SearchIcon aria-hidden="true" />}
        Find my chat
      </Button>
      {findChats.data?.length > 0 && (
        <ul className="flex flex-col gap-1">
          {findChats.data.map((chat) => (
            <li key={chat.id}>
              <Button type="button" variant="ghost" size="sm" onClick={() => onPick(chat.id)}>
                Use {chat.name} ({chat.type}, {chat.id})
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TelegramSettingsCard({ settings }) {
  const { botConfigured } = settings.telegram;
  const [chatId, setChatId] = useState(settings.telegram.chatId);
  const [enabled, setEnabled] = useState(settings.telegram.enabled);
  const update = useUpdateSettings();
  const test = useSendTelegramTest();
  const chatIdError = update.error?.details?.telegram;
  const isDirty = chatId !== settings.telegram.chatId || enabled !== settings.telegram.enabled;

  const handleSave = (event) => {
    event.preventDefault();
    update.mutate(
      { telegram: { chatId: chatId.trim(), enabled } },
      { onSuccess: () => toast.success('Telegram settings saved') },
    );
  };

  return (
    <Card>
      <form onSubmit={handleSave} noValidate>
        <CardHeader>
          <CardTitle>Telegram alerts</CardTitle>
          <CardDescription>Get new and resolved alerts on your phone.</CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          {!botConfigured ? (
            <SetupSteps />
          ) : (
            <FieldGroup>
              <div className="flex items-center gap-3">
                <Switch id="telegram-enabled" checked={enabled} onCheckedChange={setEnabled} />
                <Label htmlFor="telegram-enabled">Send alerts to Telegram</Label>
              </div>
              <Field data-invalid={Boolean(chatIdError)}>
                <FieldLabel htmlFor="telegram-chat">Chat ID</FieldLabel>
                <Input
                  id="telegram-chat"
                  value={chatId}
                  onChange={(event) => setChatId(event.target.value)}
                  placeholder="123456789"
                  inputMode="numeric"
                  className="max-w-xs font-mono"
                />
                <FieldDescription>
                  Send <span className="font-mono">/start</span> to your bot in Telegram, then click Find my chat.
                </FieldDescription>
                <FieldError errors={chatIdError?.map((message) => ({ message }))} />
              </Field>
              <ChatFinder onPick={setChatId} />
              {update.isError && !chatIdError && (
                <p role="alert" className="text-sm text-danger">
                  {update.error.message}
                </p>
              )}
            </FieldGroup>
          )}
        </CardContent>
        {botConfigured && (
          <CardFooter className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!isDirty || update.isPending}>
              {update.isPending && <LoaderCircleIcon className="animate-spin" aria-hidden="true" />}
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isDirty || !settings.telegram.chatId || test.isPending}
              title={isDirty ? 'Save first' : undefined}
              onClick={() =>
                test.mutate(undefined, {
                  onSuccess: () => toast.success('Test message sent. Check Telegram.'),
                  onError: (error) => toast.error(error.message),
                })
              }
            >
              <SendIcon aria-hidden="true" />
              Send test message
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  );
}
