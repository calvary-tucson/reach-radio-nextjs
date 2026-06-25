export function isTeacherDetailPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean)
  return segments[0] === 'teachers' && segments.length === 2 && segments[1] !== 'search'
}
