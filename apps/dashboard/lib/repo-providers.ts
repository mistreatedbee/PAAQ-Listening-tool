import { SiGithub, SiGitlab, SiBitbucket } from 'react-icons/si'
import { CloudCog } from 'lucide-react'
import type { IconType } from 'react-icons'

export type GitProviderId = 'github' | 'gitlab' | 'azure' | 'bitbucket'

export const REPO_PROVIDERS: {
  id: GitProviderId
  label: string
  Icon: IconType
  iconColor: string
  description: string
}[] = [
  { id: 'github', label: 'GitHub', Icon: SiGithub, iconColor: 'text-foreground', description: 'Connect your GitHub repositories' },
  { id: 'gitlab', label: 'GitLab', Icon: SiGitlab, iconColor: 'text-[#FC6D26]', description: 'Connect your GitLab repositories' },
  { id: 'azure', label: 'Azure DevOps', Icon: CloudCog, iconColor: 'text-[#0078D4]', description: 'Connect Azure DevOps repositories' },
  { id: 'bitbucket', label: 'Bitbucket', Icon: SiBitbucket, iconColor: 'text-[#2684FF]', description: 'Connect your Bitbucket repositories' },
]

export type RepoListItem = {
  full_name: string
  default_branch: string
  private: boolean
}
