/**
 * StudentSettingsPage — A settings page for trainees.
 * Wraps the shared SettingsContent component.
 */

import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { SettingsContent } from './SettingsContent'

export function StudentSettingsPage() {
  useDocumentTitle('Settings')
  return <SettingsContent />
}
