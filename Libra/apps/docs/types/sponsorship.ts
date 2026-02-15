/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * sponsorship.ts
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

export type SponsorshipTier = 'platinum' | 'gold' | 'silver' | 'bronze';

export interface SponsorLogo {
  type: 'gradient' | 'image' | 'placeholder';
  from?: string;
  to?: string;
  text?: string;
  src?: string;
  alt?: string;
}

export interface SponsorData {
  name: string;
  category: string;
  description: string;
  website: string;
  linkText: string;
  logo: SponsorLogo;
  isPlaceholder: boolean;
}

export interface DemoConfig {
  showPreview: boolean;
  previewType: 'logo-showcase' | 'community-badge' | 'featured-card';
  animationEnabled: boolean;
  interactiveElements: boolean;
}

export interface SponsorshipTierConfig {
  tier: SponsorshipTier;
  price: string;
  currency: string;
  features: string[];
  demoConfig: DemoConfig;
  sponsors: SponsorData[];
}

export interface SponsorshipComponentProps {
  locale?: string;
  className?: string;
  showDemo?: boolean;
  animationDelay?: number;
}

export interface DemoPreviewProps {
  tier: SponsorshipTier;
  locale?: string;
  sponsors?: SponsorData[];
  className?: string;
}
