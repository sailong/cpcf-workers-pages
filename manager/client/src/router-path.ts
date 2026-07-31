export function routePathname(value: string) {
  const boundary = value.search(/[?#]/);
  return boundary === -1 ? value : value.slice(0, boundary);
}
