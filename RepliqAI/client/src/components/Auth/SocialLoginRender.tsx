import {
  GoogleIcon,
  FacebookIcon,
  OpenIDIcon,
  GithubIcon,
  DiscordIcon,
  AppleIcon,
  SamlIcon,
} from '@librechat/client';

import SocialButton from './SocialButton';

import { useLocalize } from '~/hooks';

import { TStartupConfig } from 'librechat-data-provider';

// Yandex Icon component
const YandexIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M9.5 1c-.83 0-1.5.67-1.5 1.5V8H6V5.5c0-.83-.67-1.5-1.5-1.5S3 4.67 3 5.5V8H2v2h1v7c0 .83.67 1.5 1.5 1.5S8 17.83 8 17V10h2v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7h2v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V10h3V8h-3V2.5c0-.83-.67-1.5-1.5-1.5S14 1.67 14 2.5v3h-1.5V2.5c0-.83-.67-1.5-1.5-1.5z"/>
  </svg>
);

function SocialLoginRender({
  startupConfig,
}: {
  startupConfig: TStartupConfig | null | undefined;
}) {
  const localize = useLocalize();

  if (!startupConfig) {
    return null;
  }

  // [ENABLED] Only Yandex OAuth is enabled
  // Show Yandex button if configured
  if (startupConfig.yandexLoginEnabled) {
    return (
      <SocialButton
        key="yandex"
        enabled={true}
        serverDomain={startupConfig.serverDomain}
        oauthPath="yandex"
        Icon={YandexIcon}
        label="Sign in with Yandex"
        id="yandex"
      />
    );
  }

  // Fallback: Show other social logins if Yandex is not configured
  const providerComponents = {
    // [DISABLED] Discord OAuth
    // discord: ...

    // [DISABLED] Facebook OAuth
    // facebook: ...

    // [DISABLED] GitHub OAuth
    // github: ...

    // [DISABLED] Google OAuth
    // google: ...

    // [DISABLED] Apple OAuth
    // apple: ...

    // [DISABLED] OpenID Connect
    // openid: ...

    // [DISABLED] SAML
    // saml: ...
  };

  return (
    startupConfig.socialLoginEnabled && (
      <>
        {startupConfig.emailLoginEnabled && (
          <>
            <div className="relative mt-6 flex w-full items-center justify-center border border-t border-gray-300 uppercase dark:border-gray-600">
              <div className="absolute bg-white px-3 text-xs text-black dark:bg-gray-900 dark:text-white">
                Or
              </div>
            </div>
            <div className="mt-8" />
          </>
        )}
        <div className="mt-2">
          {startupConfig.socialLogins?.map((provider) => providerComponents[provider] || null)}
        </div>
      </>
    )
  );
}

export default SocialLoginRender;
