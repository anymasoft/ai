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

  const providerComponents = {
    // [DISABLED] Discord OAuth
    // discord: startupConfig.discordLoginEnabled && (
    //   <SocialButton
    //     key="discord"
    //     enabled={startupConfig.discordLoginEnabled}
    //     serverDomain={startupConfig.serverDomain}
    //     oauthPath="discord"
    //     Icon={DiscordIcon}
    //     label={localize('com_auth_discord_login')}
    //     id="discord"
    //   />
    // ),

    // [DISABLED] Facebook OAuth
    // facebook: startupConfig.facebookLoginEnabled && (
    //   <SocialButton
    //     key="facebook"
    //     enabled={startupConfig.facebookLoginEnabled}
    //     serverDomain={startupConfig.serverDomain}
    //     oauthPath="facebook"
    //     Icon={FacebookIcon}
    //     label={localize('com_auth_facebook_login')}
    //     id="facebook"
    //   />
    // ),

    // [DISABLED] GitHub OAuth
    // github: startupConfig.githubLoginEnabled && (
    //   <SocialButton
    //     key="github"
    //     enabled={startupConfig.githubLoginEnabled}
    //     serverDomain={startupConfig.serverDomain}
    //     oauthPath="github"
    //     Icon={GithubIcon}
    //     label={localize('com_auth_github_login')}
    //     id="github"
    //   />
    // ),

    // [DISABLED] Google OAuth
    // google: startupConfig.googleLoginEnabled && (
    //   <SocialButton
    //     key="google"
    //     enabled={startupConfig.googleLoginEnabled}
    //     serverDomain={startupConfig.serverDomain}
    //     oauthPath="google"
    //     Icon={GoogleIcon}
    //     label={localize('com_auth_google_login')}
    //     id="google"
    //   />
    // ),

    // [DISABLED] Apple OAuth
    // apple: startupConfig.appleLoginEnabled && (
    //   <SocialButton
    //     key="apple"
    //     enabled={startupConfig.appleLoginEnabled}
    //     serverDomain={startupConfig.serverDomain}
    //     oauthPath="apple"
    //     Icon={AppleIcon}
    //     label={localize('com_auth_apple_login')}
    //     id="apple"
    //   />
    // ),

    // [DISABLED] OpenID Connect
    // openid: startupConfig.openidLoginEnabled && (
    //   <SocialButton
    //     key="openid"
    //     enabled={startupConfig.openidLoginEnabled}
    //     serverDomain={startupConfig.serverDomain}
    //     oauthPath="openid"
    //     Icon={() =>
    //       startupConfig.openidImageUrl ? (
    //         <img src={startupConfig.openidImageUrl} alt="OpenID Logo" className="h-5 w-5" />
    //       ) : (
    //         <OpenIDIcon />
    //       )
    //     }
    //     label={startupConfig.openidLabel}
    //     id="openid"
    //   />
    // ),

    // [DISABLED] SAML
    // saml: startupConfig.samlLoginEnabled && (
    //   <SocialButton
    //     key="saml"
    //     enabled={startupConfig.samlLoginEnabled}
    //     serverDomain={startupConfig.serverDomain}
    //     oauthPath="saml"
    //     Icon={() =>
    //       startupConfig.samlImageUrl ? (
    //         <img src={startupConfig.samlImageUrl} alt="SAML Logo" className="h-5 w-5" />
    //       ) : (
    //         <SamlIcon />
    //       )
    //     }
    //     label={startupConfig.samlLabel ? startupConfig.samlLabel : localize('com_auth_saml_login')}
    //     id="saml"
    //   />
    // ),

    // [ENABLED] Yandex OAuth (Only enabled authentication method)
    yandex: startupConfig.yandexLoginEnabled && (
      <SocialButton
        key="yandex"
        enabled={startupConfig.yandexLoginEnabled}
        serverDomain={startupConfig.serverDomain}
        oauthPath="yandex"
        Icon={YandexIcon}
        label={localize('com_auth_yandex_login') || 'Sign in with Yandex'}
        id="yandex"
      />
    ),
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
