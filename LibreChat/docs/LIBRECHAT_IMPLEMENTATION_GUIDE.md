# РУКОВОДСТВО ПО ВНЕДРЕНИЮ ИСПРАВЛЕНИЙ

## ФАЗА 1: ДОБАВЛЕНИЕ 2FA ВЕРИФИКАЦИИ (КРИТИЧНАЯ)

### 1.1 DeleteAccount - Требование 2FA

#### ТЕКУЩИЙ КОД
```tsx
// /client/src/components/Nav/SettingsTabs/Account/DeleteAccount.tsx
const handleDeleteUser = () => {
  if (!isLocked) {
    deleteUser(undefined);  // ❌ БЕЗ 2FA!
  }
};
```

#### ИСПРАВЛЕННЫЙ КОД
```tsx
import { TwoFactorVerification } from '~/components/Auth'; // NEW

const DeleteAccount = ({ disabled = false }: { title?: string; disabled?: boolean }) => {
  const localize = useLocalize();
  const { user, logout } = useAuthContext();
  const { mutate: deleteUser, isLoading: isDeleting } = useDeleteUserMutation({
    onMutate: () => logout(),
  });

  const [isDialogOpen, setDialogOpen] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState(true);
  const [verify2FA, setVerify2FA] = useState(false);  // NEW
  const [verified2FA, setVerified2FA] = useState(false);  // NEW

  const handleDeleteUser = () => {
    if (!isLocked && verified2FA) {  // UPDATED
      deleteUser(undefined);
    } else if (!isLocked && !verified2FA) {
      setVerify2FA(true);  // NEW: Show 2FA dialog
    }
  };

  const handleInputChange = useCallback(
    (newEmailInput: string) => {
      const isEmailCorrect =
        newEmailInput.trim().toLowerCase() === user?.email.trim().toLowerCase();
      setIsLocked(!isEmailCorrect);
      setVerified2FA(false);  // NEW: Reset 2FA when email changes
    },
    [user?.email],
  );

  return (
    <>
      {verify2FA ? (
        // NEW: 2FA Verification Dialog
        <OGDialog open={isDialogOpen} onOpenChange={setDialogOpen}>
          <OGDialogContent className="w-11/12 max-w-md">
            <OGDialogHeader>
              <OGDialogTitle className="text-lg font-medium leading-6">
                {localize('com_nav_2fa_verification')}
              </OGDialogTitle>
            </OGDialogHeader>
            <TwoFactorVerification
              onSuccess={() => {
                setVerified2FA(true);
                setVerify2FA(false);
                handleDeleteUser();
              }}
              onError={() => {
                showToast({ message: localize('com_error_2fa_invalid'), status: 'error' });
              }}
            />
          </OGDialogContent>
        </OGDialog>
      ) : (
        // EXISTING: Email confirmation dialog
        <OGDialog open={isDialogOpen} onOpenChange={setDialogOpen}>
          <div className="flex items-center justify-between">
            <Label id="delete-account-label">{localize('com_nav_delete_account')}</Label>
            <OGDialogTrigger asChild>
              <Button
                aria-labelledby="delete-account-label"
                variant="destructive"
                onClick={() => setDialogOpen(true)}
                disabled={disabled}
              >
                {localize('com_ui_delete')}
              </Button>
            </OGDialogTrigger>
          </div>
          <OGDialogContent className="w-11/12 max-w-md">
            <OGDialogHeader>
              <OGDialogTitle className="text-lg font-medium leading-6">
                {localize('com_nav_delete_account_confirm')}
              </OGDialogTitle>
            </OGDialogHeader>
            <div className="mb-8 text-sm text-black dark:text-white">
              <ul className="font-semibold text-amber-600">
                <li>{localize('com_nav_delete_warning')}</li>
                <li>{localize('com_nav_delete_data_info')}</li>
              </ul>
            </div>
            <div className="flex-col items-center justify-center">
              <div className="mb-4">
                {renderInput(
                  localize('com_nav_delete_account_email_placeholder'),
                  'email-confirm-input',
                  user?.email ?? '',
                  (e) => handleInputChange(e.target.value),
                )}
              </div>
              {renderDeleteButton(
                handleDeleteUser,
                isDeleting,
                isLocked || !verified2FA,  // UPDATED: Also check 2FA
                localize
              )}
            </div>
          </OGDialogContent>
        </OGDialog>
      )}
    </>
  );
};
```

### 1.2 ClearChats - Требование 2FA

```tsx
import { TwoFactorVerification } from '~/components/Auth'; // NEW

export const ClearChats = () => {
  const localize = useLocalize();
  const [open, setOpen] = useState(false);
  const [verify2FA, setVerify2FA] = useState(false);  // NEW
  const [verified2FA, setVerified2FA] = useState(false);  // NEW
  const { newConversation } = useNewConvo();
  const clearConvosMutation = useClearConversationsMutation();

  const clearConvos = () => {
    // NEW: Check 2FA before clearing
    if (!verified2FA) {
      setVerify2FA(true);
      return;
    }

    clearConvosMutation.mutate(
      {},
      {
        onSuccess: () => {
          clearAllConversationStorage();
          newConversation();
          setOpen(false);
          setVerified2FA(false);
        },
      },
    );
  };

  if (verify2FA) {
    return (
      <div className="flex items-center justify-between">
        <Label id="2fa-label">{localize('com_nav_2fa_verification')}</Label>
        <OGDialog open={open} onOpenChange={setOpen}>
          <OGDialogTemplate
            showCloseButton={false}
            title={localize('com_nav_2fa_verification')}
            className="max-w-[450px]"
            main={<TwoFactorVerification onSuccess={() => setVerified2FA(true)} />}
          />
        </OGDialog>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <Label id="clear-all-chats-label">{localize('com_nav_clear_all_chats')}</Label>
      <OGDialog open={open} onOpenChange={setOpen}>
        <OGDialogTrigger asChild>
          <Button
            aria-labelledby="clear-all-chats-label"
            variant="destructive"
            onClick={() => setOpen(true)}
          >
            {localize('com_ui_delete')}
          </Button>
        </OGDialogTrigger>
        <OGDialogTemplate
          showCloseButton={false}
          title={localize('com_nav_confirm_clear')}
          className="max-w-[450px]"
          main={
            <Label className="break-words">
              {localize('com_nav_clear_conversation_confirm_message')}
            </Label>
          }
          selection={{
            selectHandler: clearConvos,
            selectClasses:
              'bg-destructive text-white transition-all duration-200 hover:bg-destructive/80',
            selectText: clearConvosMutation.isLoading ? <Spinner /> : localize('com_ui_delete'),
          }}
        />
      </OGDialog>
    </div>
  );
};
```

### 1.3 RevokeKeys - Требование 2FA

```tsx
import { TwoFactorVerification } from '~/components/Auth'; // NEW

export const RevokeKeys = ({
  disabled = false,
  setDialogOpen,
}: {
  disabled?: boolean;
  setDialogOpen?: (open: boolean) => void;
}) => {
  const localize = useLocalize();
  const [open, setOpen] = useState(false);
  const [verify2FA, setVerify2FA] = useState(false);  // NEW
  const revokeKeysMutation = useRevokeAllUserKeysMutation();

  const handleSuccess = () => {
    if (!setDialogOpen) {
      return;
    }
    setDialogOpen(false);
    setOpen(false);
    setVerify2FA(false);  // NEW: Reset
  };

  const onClick = () => {
    if (!verify2FA) {
      setVerify2FA(true);  // NEW: Request 2FA
      return;
    }
    revokeKeysMutation.mutate({}, { onSuccess: handleSuccess });
  };

  const isLoading = revokeKeysMutation.isLoading;

  if (verify2FA) {
    return (
      <div className="flex items-center justify-between">
        <Label id="2fa-label">{localize('com_nav_2fa_verification')}</Label>
        <OGDialog open={open} onOpenChange={setOpen}>
          <OGDialogTemplate
            showCloseButton={false}
            title={localize('com_nav_2fa_verification')}
            main={
              <TwoFactorVerification
                onSuccess={() => {
                  setVerify2FA(false);
                  onClick();
                }}
              />
            }
          />
        </OGDialog>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <Label id="revoke-info-label">{localize('com_ui_revoke_info')}</Label>
      <OGDialog open={open} onOpenChange={setOpen}>
        <OGDialogTrigger asChild>
          <Button
            variant="destructive"
            onClick={() => setOpen(true)}
            disabled={disabled}
            aria-labelledby="revoke-info-label"
          >
            {localize('com_ui_revoke')}
          </Button>
        </OGDialogTrigger>
        <OGDialogTemplate
          showCloseButton={false}
          title={localize('com_ui_revoke_keys')}
          className="max-w-[450px]"
          main={
            <Label className="text-left text-sm font-medium">
              {localize('com_ui_revoke_keys_confirm')}
            </Label>
          }
          selection={{
            selectHandler: onClick,
            selectClasses:
              'bg-destructive text-white transition-all duration-200 hover:bg-destructive/80',
            selectText: isLoading ? <Spinner /> : localize('com_ui_revoke'),
          }}
        />
      </OGDialog>
    </div>
  );
};
```

---

## ФАЗА 2: ВАЛИДАЦИЯ ИМПОРТА (КРИТИЧНАЯ)

### 2.1 ImportConversations - Валидация JSON

```tsx
import { useState } from 'react';
import { useImportConversationsMutation } from '~/data-provider';
import DOMPurify from 'dompurify';  // NEW: для санитизации

export default function ImportConversations() {
  const localize = useLocalize();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);  // NEW
  const [error, setError] = useState<string>('');  // NEW
  const importMutation = useImportConversationsMutation();

  // NEW: Validate JSON structure
  const validateJSON = (json: any): boolean => {
    try {
      // Must be an array or object with conversations
      if (!Array.isArray(json) && typeof json !== 'object') {
        throw new Error('Invalid format: must be array or object');
      }

      // Validate file size (max 50MB)
      if (file && file.size > 50 * 1024 * 1024) {
        throw new Error('File too large: max 50MB');
      }

      // If array, validate each conversation
      const conversations = Array.isArray(json) ? json : json.conversations || [];
      
      conversations.forEach((conv: any, idx: number) => {
        if (!conv.id || !Array.isArray(conv.messages)) {
          throw new Error(`Invalid conversation at index ${idx}`);
        }
        
        // Validate messages structure
        conv.messages.forEach((msg: any, msgIdx: number) => {
          if (!msg.role || !msg.content) {
            throw new Error(`Invalid message at conversation ${idx}, message ${msgIdx}`);
          }
        });
      });

      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  };

  // NEW: Sanitize conversation content
  const sanitizeConversations = (json: any): any => {
    const conversations = Array.isArray(json) ? json : json.conversations || [];
    
    return conversations.map((conv: any) => ({
      ...conv,
      messages: conv.messages.map((msg: any) => ({
        ...msg,
        content: DOMPurify.sanitize(msg.content, {
          ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'code', 'pre'],
          ALLOWED_ATTR: [],
        }),
      })),
    }));
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFile(file);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        
        // NEW: Validate structure
        if (!validateJSON(json)) {
          return;
        }

        // NEW: Show preview
        const convCount = Array.isArray(json) ? json.length : json.conversations?.length || 0;
        setPreview({
          conversationCount: convCount,
          firstConv: json[0]?.title || json.conversations?.[0]?.title || 'Untitled',
        });

        // NEW: Store sanitized data
        const sanitized = sanitizeConversations(json);
        setFile(file); // Store for later use
      } catch (err) {
        setError(`Invalid JSON: ${(err as Error).message}`);
        setFile(null);
        setPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        
        if (!validateJSON(json)) {
          return;
        }

        const sanitized = sanitizeConversations(json);
        
        // NEW: Log the import
        console.log('[ImportConversations] User imported', {
          conversationCount: sanitized.length,
          timestamp: new Date().toISOString(),
        });

        importMutation.mutate(
          { conversations: sanitized },
          {
            onSuccess: () => {
              setFile(null);
              setPreview(null);
              setError('');
              // Show success toast
            },
            onError: (err) => {
              setError(`Import failed: ${(err as Error).message}`);
            },
          },
        );
      } catch (err) {
        setError(`Invalid JSON: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex items-center justify-between">
      <Label>{localize('com_nav_import_conversations')}</Label>
      
      <div className="flex gap-2">
        <input
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          disabled={importMutation.isLoading}
          className="text-sm"
        />
        
        {/* NEW: Preview section */}
        {preview && (
          <div className="text-sm text-green-600">
            ✓ {preview.conversationCount} conversations ready
          </div>
        )}
        
        {/* NEW: Error section */}
        {error && (
          <div className="text-sm text-red-600">
            ✗ {error}
          </div>
        )}
        
        <Button
          onClick={handleImport}
          disabled={!file || importMutation.isLoading || !!error}
        >
          {importMutation.isLoading ? <Spinner /> : localize('com_ui_import')}
        </Button>
      </div>
    </div>
  );
}
```

---

## ФАЗА 3: ЗАЩИТА API КЛЮЧЕЙ (КРИТИЧНАЯ)

### 3.1 AgentApiKeys - Маскировка и 2FA

```tsx
import { TwoFactorVerification } from '~/components/Auth'; // NEW

export const AgentApiKeys = () => {
  const localize = useLocalize();
  const [showFullKey, setShowFullKey] = useState(false);  // NEW
  const [requireVerification, setRequireVerification] = useState(true);  // NEW
  const { data: keys } = useGetAgentApiKeysQuery();

  const maskKey = (key: string): string => {
    // Show only last 4 characters
    return key ? '*'.repeat(key.length - 4) + key.slice(-4) : '****';
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    // Show toast notification
  };

  const handleShowFullKey = () => {
    // NEW: Require 2FA verification before showing
    setRequireVerification(true);
  };

  if (requireVerification) {
    return (
      <TwoFactorVerification
        onSuccess={() => {
          setRequireVerification(false);
          setShowFullKey(true);
          // Log the access
          console.log('[AgentApiKeys] User accessed API keys at', new Date().toISOString());
        }}
        onError={() => {
          setRequireVerification(true);
          // Show error toast
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>{localize('com_nav_agent_api_keys')}</Label>
        <Button variant="outline" onClick={() => setShowFullKey(!showFullKey)}>
          {showFullKey ? localize('com_ui_hide') : localize('com_ui_show')}
        </Button>
      </div>

      {keys?.map((key) => (
        <div key={key.id} className="flex items-center gap-2 p-3 bg-gray-100 rounded">
          <code className="flex-1 font-mono text-sm">
            {showFullKey ? key.key : maskKey(key.key)}
          </code>
          
          {showFullKey && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(key.key)}
            >
              {localize('com_ui_copy')}
            </Button>
          )}
          
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              // Handle revoke
            }}
          >
            {localize('com_ui_revoke')}
          </Button>
        </div>
      ))}

      <div className="text-xs text-gray-600">
        <p>{localize('com_nav_api_keys_warning')}</p>
        <p>{localize('com_nav_api_keys_ip_restriction')}</p>
      </div>
    </div>
  );
};
```

---

## ФАЗА 4: ВАЛИДАЦИЯ AVATAR (ВАЖНАЯ)

### 4.1 Avatar Upload - Валидация

```tsx
import React, { useState, useRef } from 'react';
import { useUpdateAvatarMutation } from '~/data-provider';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const MIN_SIZE = 50; // 50x50px
const MAX_SIZE_PX = 1000; // 1000x1000px

export default function Avatar() {
  const localize = useLocalize();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>('');
  const [preview, setPreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const updateAvatarMutation = useUpdateAvatarMutation();

  const validateImage = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      // Check file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`Invalid format. Allowed: JPEG, PNG, WebP`);
        resolve(false);
        return;
      }

      // Check file size
      if (file.size > MAX_SIZE) {
        setError(`File too large. Max: 5MB, Got: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
        resolve(false);
        return;
      }

      // Check image dimensions
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          if (img.width < MIN_SIZE || img.height < MIN_SIZE) {
            setError(`Image too small. Min: ${MIN_SIZE}x${MIN_SIZE}px`);
            resolve(false);
            return;
          }

          if (img.width > MAX_SIZE_PX || img.height > MAX_SIZE_PX) {
            setError(`Image too large. Max: ${MAX_SIZE_PX}x${MAX_SIZE_PX}px`);
            resolve(false);
            return;
          }

          setError('');
          setPreview(e.target?.result as string);
          resolve(true);
        };

        img.onerror = () => {
          setError('Invalid image file');
          resolve(false);
        };

        img.src = e.target?.result as string;
      };

      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const isValid = await validateImage(file);

    if (isValid) {
      // Compress image before upload
      const canvas = document.createElement('canvas');
      const img = new Image();

      img.onload = () => {
        const maxDim = 500; // Resize to max 500px
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              updateAvatarMutation.mutate(blob as any, {
                onSuccess: () => {
                  setPreview('');
                  setError('');
                  setUploading(false);
                },
                onError: (err) => {
                  setError((err as Error).message);
                  setUploading(false);
                },
              });
            }
          },
          'image/jpeg',
          0.8,
        );
      };

      img.src = preview;
    } else {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label>{localize('com_nav_avatar')}</Label>

      {preview && (
        <img
          src={preview}
          alt="Preview"
          className="w-20 h-20 rounded-full object-cover"
        />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        onChange={handleFileSelect}
        disabled={uploading}
        className="hidden"
      />

      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? <Spinner /> : localize('com_ui_upload')}
      </Button>

      <p className="text-xs text-gray-600">
        {localize('com_nav_avatar_requirements')}: JPEG, PNG, WebP (Max: 5MB, 50-1000px)
      </p>
    </div>
  );
}
```

---

## ФАЗА 5: ПРЕДУПРЕЖДЕНИЯ И УЛУЧШЕНИЯ UI

### 5.1 Warning для cloudBrowserVoices

```tsx
import { InfoIcon } from 'lucide-react';
import { Tooltip } from '@librechat/client';

export const CloudBrowserVoicesSwitch = () => {
  const localize = useLocalize();
  const [cloudBrowserVoices, setCloudBrowserVoices] = useRecoilState(
    store.cloudBrowserVoices,
  );

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span>{localize('com_nav_cloud_browser_voices')}</span>
        
        {/* NEW: Warning tooltip */}
        <Tooltip
          content={
            <>
              <p className="font-semibold">{localize('com_nav_privacy_warning')}</p>
              <p>{localize('com_nav_cloud_voices_sends_data')}</p>
              <p>
                {localize('com_nav_read_more')}:{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-400"
                >
                  Google Privacy Policy
                </a>
              </p>
            </>
          }
        >
          <InfoIcon className="w-4 h-4 text-amber-600 cursor-help" />
        </Tooltip>
      </div>

      <Switch
        checked={cloudBrowserVoices}
        onCheckedChange={setCloudBrowserVoices}
      />
    </div>
  );
};
```

---

## БЭКЕНД ИЗМЕНЕНИЯ

### Логирование операций

```typescript
// /api/models/auditLog.ts
interface AuditLogEntry {
  userId: string;
  action: string;
  resource: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failed';
  details?: Record<string, any>;
}

export async function logAuditAction(
  userId: string,
  action: string,
  resource: string,
  req: Request,
  status: 'success' | 'failed',
  details?: Record<string, any>,
) {
  const entry: AuditLogEntry = {
    userId,
    action,
    resource,
    timestamp: new Date(),
    ipAddress: req.headers.get('x-forwarded-for') || req.socket.remoteAddress || '',
    userAgent: req.headers.get('user-agent') || '',
    status,
    details,
  };

  // Save to database
  await AuditLog.create(entry);

  // Alert if critical action
  if (['DELETE_ACCOUNT', 'REVOKE_KEYS', 'CLEAR_CHATS'].includes(action)) {
    // Send alert to admin/monitoring system
    await alertAdmins(`Critical action: ${action} by ${userId}`);
  }
}
```

### Защита DeleteAccount

```typescript
// /api/routes/user.ts
router.delete('/account', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Step 1: Verify 2FA
    const is2FAVerified = req.headers['x-2fa-verified'] === 'true';
    if (!is2FAVerified) {
      return res.status(401).json({ error: 'Two-factor authentication required' });
    }

    // Step 2: Create grace period
    const user = await User.findById(userId);
    user.deletionScheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h later
    await user.save();

    // Step 3: Send confirmation email
    await sendEmail(user.email, 'Account Deletion Scheduled', {
      template: 'deletion_confirmation',
      confirmUrl: `${process.env.FRONTEND_URL}/account/confirm-deletion?token=${token}`,
      cancelUrl: `${process.env.FRONTEND_URL}/account/cancel-deletion?token=${token}`,
    });

    // Step 4: Log action
    await logAuditAction(userId, 'DELETE_ACCOUNT', 'account', req, 'success', {
      scheduledFor: user.deletionScheduledFor,
    });

    res.json({ message: 'Account deletion scheduled. Check your email to confirm.' });
  } catch (error) {
    await logAuditAction(userId, 'DELETE_ACCOUNT', 'account', req, 'failed', {
      error: (error as Error).message,
    });
    res.status(500).json({ error: (error as Error).message });
  }
});
```

---

## ТЕСТИРОВАНИЕ

### Юнит тесты для валидации

```typescript
// Tests for validateJSON
describe('ImportConversations', () => {
  it('should reject invalid JSON', () => {
    expect(() => validateJSON('invalid')).toThrow();
  });

  it('should accept valid conversation array', () => {
    const valid = [
      {
        id: '1',
        title: 'Test',
        messages: [{ role: 'user', content: 'Hello' }],
      },
    ];
    expect(validateJSON(valid)).toBe(true);
  });

  it('should sanitize XSS content', () => {
    const input = '<script>alert("xss")</script>Hello';
    const output = sanitizeConversations([
      {
        id: '1',
        messages: [{ role: 'user', content: input }],
      },
    ]);
    expect(output[0].messages[0].content).not.toContain('<script>');
  });

  it('should reject files larger than 50MB', () => {
    const largeFile = new File(['x'.repeat(51 * 1024 * 1024)], 'large.json');
    expect(() => validateJSON({})).toThrow('File too large');
  });
});
```

---

## ЧЕКЛИСТ ВНЕДРЕНИЯ

### ФАЗА 1: КРИТИЧНЫЕ (НЕДЕЛЯ 1)
- [ ] Добавить 2FA в DeleteAccount
- [ ] Добавить 2FA в ClearChats
- [ ] Добавить 2FA в RevokeKeys
- [ ] Маскировать AgentApiKeys в UI
- [ ] Валидировать ImportConversations JSON
- [ ] Добавить санитизацию контента

### ФАЗА 2: ВАЖНЫЕ (НЕДЕЛЯ 2)
- [ ] Валидировать Avatar загрузку
- [ ] Требовать 2FA для просмотра AgentApiKeys
- [ ] Добавить warning для cloudBrowserVoices
- [ ] Добавить логирование критичных операций
- [ ] Email уведомления для операций

### ФАЗА 3: УЛУЧШЕНИЯ (НЕДЕЛЯ 3-4)
- [ ] Grace period для DeleteAccount
- [ ] Бэкап для ClearChats
- [ ] Отложенный отзыв для RevokeKeys
- [ ] Синхронизация GENERAL/CHAT
- [ ] Admin audit log интерфейс

---

**Документ подготовлен:** 2026-03-04  
**Версия:** 1.0  
**Язык:** TypeScript/React  
**Статус:** Готово к кодированию

