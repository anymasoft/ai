/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * types.ts
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

export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  html_url: string
  clone_url: string
  ssh_url: string
  created_at: string
  updated_at: string
  pushed_at: string
  size: number
  stargazers_count: number
  watchers_count: number
  language: string | null
  forks_count: number
  archived: boolean
  disabled: boolean
  open_issues_count: number
  license: {
    key: string
    name: string
    spdx_id: string
    url: string | null
    node_id: string
  } | null
  allow_forking: boolean
  is_template: boolean
  web_commit_signoff_required: boolean
  topics: string[]
  visibility: 'public' | 'private'
  default_branch: string
  permissions: {
    admin: boolean
    maintain: boolean
    push: boolean
    triage: boolean
    pull: boolean
  }
}

export interface GitHubUser {
  id: number
  login: string
  node_id: string
  avatar_url: string
  gravatar_id: string
  url: string
  html_url: string
  followers_url: string
  following_url: string
  gists_url: string
  starred_url: string
  subscriptions_url: string
  organizations_url: string
  repos_url: string
  events_url: string
  received_events_url: string
  type: string
  site_admin: boolean
  name: string
  company: string | null
  blog: string
  location: string | null
  email: string | null
  hireable: boolean | null
  bio: string | null
  twitter_username: string | null
  public_repos: number
  public_gists: number
  followers: number
  following: number
  created_at: string
  updated_at: string
}

export interface GitHubInstallationStatus {
  isInstalled: boolean
  installationType: 'user' | 'organization' | null
  requiresOAuth: boolean
  hasUserToken: boolean
  accountLogin: string | null
  accountType: string | null
  installedAt?: Date
}

export interface GitHubAuthState {
  isAuthenticated: boolean
  user: GitHubUser | null
  isLoading: boolean
  error: string | null
}

export interface GitHubIntegrationState {
  auth: GitHubAuthState
  installation: GitHubInstallationStatus | null
  repositories: GitHubRepository[]
  selectedRepository: GitHubRepository | null
  isCreatingRepository: boolean
  isPushing: boolean
  pushError: string | null
  pushSuccess: boolean
  isCheckingInstallation: boolean
  forcePush: boolean
}



export interface PushToRepositoryRequest {
  repository: GitHubRepository
  projectId: string // Project ID, used to fetch file data in backend
  commitMessage: string
  branch?: string
  forcePush?: boolean
}

export interface GitHubModalProps {
  open: boolean
  onClose: () => void
  projectId?: string
}

export interface GitHubAuthStepProps {
  onAuthenticated: (user: GitHubUser) => void
  isLoading: boolean
  error: string | null
}

export interface ProjectRepositoryInfo {
  projectId: string
  projectName: string
  gitUrl: string | null
  gitBranch: string | null
  hasRepository: boolean
}

export interface CreateProjectRepositoryRequest {
  projectId: string
  description?: string
  private: boolean
  forceUpdate?: boolean
}

export interface CreateProjectRepositoryResponse {
  repository: GitHubRepository | {
    name: string
    clone_url: string
    html_url: string
    default_branch: string
  }
  project?: any // Updated project data
  projectUpdated: boolean
  alreadyLinked: boolean
  message: string
}

export interface RepositorySelectionStepProps {
  user: GitHubUser
  repositories: GitHubRepository[]
  selectedRepository: GitHubRepository | null
  onRepositorySelect: (repository: GitHubRepository) => void
  onCreateNew: () => void
  isLoading: boolean
}

export interface CreateRepositoryStepProps {
  user: GitHubUser
  onRepositoryCreated: (repository: GitHubRepository) => void
  onBack: () => void
  isCreating: boolean
  error: string | null
}

export interface PushCodeStepProps {
  repository: GitHubRepository
  onPushComplete: () => void
  onBack: () => void
  isPushing: boolean
  pushError: string | null
  pushSuccess: boolean
}
