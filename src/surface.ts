export type Surface = 'panel' | 'toasts';

/** Unknown or retired values (e.g. the old 'statusbar') fall back to 'panel'. */
export function coerceSurface(v: unknown): Surface {
  return v === 'toasts' ? 'toasts' : 'panel';
}
