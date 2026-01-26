import JSZip from 'jszip';

export interface ProjectAnalysis {
    framework: string;
    buildCommand: string;
    outputDir: string;
    detected: boolean;
}

export const analyzePackageJson = (pkg: any): ProjectAnalysis => {
    const scripts = pkg.scripts || {};
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    let analysis: ProjectAnalysis = {
        framework: 'Other',
        buildCommand: '',
        outputDir: 'dist',
        detected: true
    };

    // Detect Framework
    if (deps['next']) {
        analysis.framework = 'Next.js (Static)';
        analysis.buildCommand = 'npm install && npm run build';
        analysis.outputDir = 'out'; // Next.js static export default
    } else if (deps['react-scripts']) {
        analysis.framework = 'React (CRA)';
        analysis.buildCommand = 'npm install && npm run build';
        analysis.outputDir = 'build';
    } else if (deps['vite']) {
        analysis.framework = 'Vite';
        analysis.buildCommand = 'npm install && npm run build';
        analysis.outputDir = 'dist';
    } else if (deps['vue']) {
        analysis.framework = 'Vue';
        analysis.buildCommand = 'npm install && npm run build';
        analysis.outputDir = 'dist';
    } else if (deps['tailwindcss'] && !deps['react'] && !deps['vue']) {
        // Tailwind Static Site (like iori-nav)
        analysis.framework = 'Static (Tailwind)';
        analysis.outputDir = 'public'; // Common for simple static sites
        // Try to find a build script
        if (scripts['build']) {
            analysis.buildCommand = 'npm install && npm run build';
        } else if (scripts['build:css']) {
            analysis.buildCommand = 'npm install && npm run build:css';
        } else {
            analysis.buildCommand = 'npm install'; // Safe fallback?
        }
    } else {
        // Generic Fallback
        analysis.detected = false;
        if (scripts['build']) {
            analysis.buildCommand = 'npm install && npm run build';
        }
    }

    // Heuristics for special cases
    // if package has husky, we might want --ignore-scripts in install?
    // But that's hard to generalize.

    return analysis;
};

export const analyzeFiles = async (files: File[]): Promise<ProjectAnalysis | null> => {
    // Find package.json (handling nested root if consistent)
    // We assume files are from webkitRelativePath

    // 1. Find root
    if (files.length === 0) return null;

    let rootPath = '';
    const firstPathParts = files[0].webkitRelativePath.split('/');
    if (firstPathParts.length > 1) {
        // Likely enclosed in a folder
        const candidate = firstPathParts[0] + '/';
        if (files.every(f => f.webkitRelativePath.startsWith(candidate))) {
            rootPath = candidate;
        }
    }

    const pkgFile = files.find(f => f.webkitRelativePath === rootPath + 'package.json');

    if (pkgFile) {
        try {
            const text = await pkgFile.text();
            const json = JSON.parse(text);
            return analyzePackageJson(json);
        } catch (e) {
            console.error("Failed to parse package.json", e);
        }
    }
    return null;
};

export const analyzeZip = async (zipFile: File): Promise<ProjectAnalysis | null> => {
    try {
        const zip = await JSZip.loadAsync(zipFile);

        // Find package.json
        // It might be at root or in a subfolder
        let pkgFile = zip.file('package.json');

        if (!pkgFile) {
            // Search one level deep
            const rootFolders = Object.keys(zip.files).filter(p => p.endsWith('/') && p.split('/').length === 2);
            if (rootFolders.length === 1) {
                pkgFile = zip.file(rootFolders[0] + 'package.json');
            }
        }

        if (pkgFile) {
            const text = await pkgFile.async('string');
            const json = JSON.parse(text);
            return analyzePackageJson(json);
        }
    } catch (e) {
        console.error("Failed to analyze zip", e);
    }
    return null;
};
