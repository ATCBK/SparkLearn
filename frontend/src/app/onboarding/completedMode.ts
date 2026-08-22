export function isProfileDialogCompletedMode(search: string) {
  return new URLSearchParams(search).get('view') === 'completed'
}
