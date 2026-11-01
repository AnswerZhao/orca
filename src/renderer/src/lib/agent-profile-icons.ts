import {
  BookOpen,
  Bot,
  Brain,
  Bug,
  Code,
  Compass,
  PenLine,
  Rocket,
  Shield,
  Sparkles,
  type LucideIcon
} from 'lucide-react'
import type { AgentProfileIcon } from '../../../shared/agent-profile'

/** Lucide component for each profile icon key the shared schema allows. */
export const AGENT_PROFILE_ICON_COMPONENTS: Record<AgentProfileIcon, LucideIcon> = {
  sparkles: Sparkles,
  bot: Bot,
  brain: Brain,
  code: Code,
  compass: Compass,
  shield: Shield,
  bug: Bug,
  rocket: Rocket,
  book: BookOpen,
  pen: PenLine
}
