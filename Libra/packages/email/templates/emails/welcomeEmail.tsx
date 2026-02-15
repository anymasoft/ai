/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * welcomeEmail.tsx
 * Copyright (C) 2025 Nextify Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 */

import {
  Heading,
  Text,
  Section,
  Link,
} from '@react-email/components';
import type * as React from 'react';
import {
  Button,
  ContentSection,
  EmailContainer,
  InfoBox
} from '../../components';
import { getPlanBenefits, isFreePlan } from '../../utils/plan-utils';

interface WelcomeEmailTemplateProps {
  planName: string;
}

/**
 * Welcome email sent to new subscribers
 * Displays personalized content based on the user's plan
 */
export const WelcomeEmailTemplate: React.FC<WelcomeEmailTemplateProps> = ({
  planName
}) => {
  // Get plan-specific benefits and content
  const planBenefits = getPlanBenefits(planName);
  const isFree = isFreePlan(planName);

  // Determine support text based on plan type
  const supportText = isFree
    ? 'Need help? Check out our community support on Forum.'
    : 'Need help? Contact our support team or check out our Help Center.';

  return (
    <EmailContainer
      title={`Welcome to the ${planName} Plan`}
      previewText={`Welcome to the ${planName} Plan!`}
    >
      <ContentSection>
        <Heading as="h2" className="mt-0 text-gray-800 text-xl font-semibold">
          Welcome to the {planName} Plan!
        </Heading>

        <Text className="mb-6 text-gray-600 leading-relaxed">
          {planBenefits.welcomeMessage}
        </Text>

        {/* Plan Benefits */}
        <InfoBox title={`Your ${planName} Plan Benefits`} variant="info">
          <ul className="text-gray-600 m-0 list-disc pl-5">
            {planBenefits.features.map((feature, index) => (
              <li
                key={index}
                className={index === planBenefits.features.length - 1 ? "m-0" : "mb-2"}
              >
                {feature}
              </li>
            ))}
          </ul>
        </InfoBox>

        <Text className="text-gray-600 mb-6 leading-relaxed">
          Your subscription is now active. Here's how to get started with {planName}:
        </Text>

        {/* Call to Action Button */}
        <Section className="text-center mb-7">
          <Button href="#" variant="primary">
            {planBenefits.ctaText}
          </Button>
        </Section>

        {/* Help Center */}
        <Text className="text-gray-600 mb-2 leading-relaxed">
          {supportText} {!isFree && (
            <>
              Check out our {" "}
              <Link href="#" className="text-brand no-underline hover:underline">
                Help Center
              </Link>{" "}
              for detailed guides.
            </>
          )}
        </Text>
      </ContentSection>
    </EmailContainer>
  );
};

export default WelcomeEmailTemplate; 