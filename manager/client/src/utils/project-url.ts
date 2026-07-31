import type { PlatformConfig, Project } from '../types';

export function projectPublicUrl(project: Project, config: PlatformConfig): string {
    const protocol = config.projectProtocol.replace(/:$/, '');
    const host = `${project.name.toLowerCase()}-${project.type}.${config.projectBaseDomain}`;
    const port = config.projectPort ? `:${config.projectPort}` : '';
    return `${protocol}://${host}${port}`;
}
