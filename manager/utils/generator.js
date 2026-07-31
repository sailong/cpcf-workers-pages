const cryptoHelper = require('./crypto-helper');
const { normalizeProjectCompatibility } = require('../services/project-compatibility');

function tomlString(value) {
    return JSON.stringify(String(value));
}

function tomlKey(value) {
    return /^[A-Za-z0-9_-]+$/.test(value) ? value : tomlString(value);
}

function tomlValue(value) {
    if (typeof value === 'string') return tomlString(value);
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (Array.isArray(value)) return `[${value.map(tomlValue).join(', ')}]`;
    if (value && typeof value === 'object') {
        return `{ ${Object.entries(value).map(([key, item]) => `${tomlKey(key)} = ${tomlValue(item)}`).join(', ')} }`;
    }
    return tomlString(JSON.stringify(value));
}

/**
 * Generates wrangler.toml content based on project config
 * @param {Object} project 
 * @param {Object} resources - { kv: [], d1: [] }
 */
function generateConfig(project, resources = { kv: [], d1: [] }, options = {}) {
    const { name, type, mainFile, bindings, port, envVars } = project;
    const { compatibilityDate, compatibilityFlags } = normalizeProjectCompatibility(project);

    // Basic Config
    let config = [
        `name = ${tomlString(name)}`,
        `compatibility_date = ${tomlString(compatibilityDate)}`,
        `compatibility_flags = ${tomlValue(compatibilityFlags)}`
    ];

    if (type === 'worker') {
        config.push(`main = ${tomlString(mainFile)}`);
    } else if (type === 'pages') {
        config.push(`pages_build_output_dir = "./"`);
    }

    // Bindings - KV
    if (options.includeResourceBindings !== false && bindings && bindings.kv && bindings.kv.length > 0) {
        bindings.kv.forEach(binding => {
            const kvResource = resources.kv.find(r => r.id === binding.resourceId);
            if (kvResource) {
                config.push("");
                config.push("[[kv_namespaces]]");
                config.push(`binding = ${tomlString(binding.varName)}`);
                config.push(`id = ${tomlString(kvResource.id)}`);
            }
        });
    }

    // Bindings - D1
    if (options.includeResourceBindings !== false && bindings && bindings.d1 && bindings.d1.length > 0) {
        bindings.d1.forEach(binding => {
            const d1Resource = resources.d1.find(r => r.id === binding.resourceId);
            if (d1Resource) {
                config.push("");
                config.push("[[d1_databases]]");
                config.push(`binding = ${tomlString(binding.varName)}`);
                config.push(`database_name = ${tomlString(d1Resource.name)}`);
                config.push(`database_id = ${tomlString(d1Resource.id)}`);
                // 为本地开发添加 preview_database_id，通常与 database_id 相同即可
                config.push(`preview_database_id = ${tomlString(d1Resource.id)}`);
            }
        });
    }

    // Bindings - R2
    if (options.includeResourceBindings !== false && bindings && bindings.r2 && bindings.r2.length > 0) {
        bindings.r2.forEach(binding => {
            const r2Resource = resources.r2.find(r => r.id === binding.resourceId);
            if (r2Resource) {
                config.push("");
                config.push("[[r2_buckets]]");
                config.push(`binding = ${tomlString(binding.varName)}`);
                config.push(`bucket_name = ${tomlString(r2Resource.name)}`);
            }
        });
    }

    // Environment Variables (支持三种格式: plain, json, secret)
    if (envVars && Object.keys(envVars).length > 0) {
        // 普通变量（plain 和 json）
        const plainVars = Object.entries(envVars).filter(([_, v]) =>
            v.type === 'plain' || v.type === 'json'
        );

        if (plainVars.length > 0) {
            config.push("");
            config.push("[vars]");
            plainVars.forEach(([key, varData]) => {
                if (varData.type === 'plain') {
                    // 明文字符串
                    config.push(`${tomlKey(key)} = ${tomlString(varData.value)}`);
                } else if (varData.type === 'json') {
                    // JSON 对象
                    const jsonValue = typeof varData.value === 'string'
                        ? JSON.parse(varData.value)
                        : varData.value;
                    config.push(`${tomlKey(key)} = ${tomlValue(jsonValue)}`);
                }
            });
        }

        // 加密变量（secret）
        const secrets = Object.entries(envVars).filter(([_, v]) => v.type === 'secret');
        if (secrets.length > 0) {
            secrets.forEach(([key, varData]) => {
                config.push("");
                config.push("[[unsafe.bindings]]");
                config.push(`name = ${tomlString(key)}`);
                config.push(`type = "secret_text"`);
                const secretValue = cryptoHelper.decryptSecret(varData.value, project.id);
                config.push(`text = ${JSON.stringify(secretValue)}`);
            });
        }
    }

    if (options.assetsDirectory) {
        config.push('');
        config.push('[assets]');
        config.push(`directory = ${tomlString(options.assetsDirectory)}`);
        config.push(`binding = ${tomlString(options.assetsBinding || 'ASSETS')}`);
        config.push(`run_worker_first = ${options.runWorkerFirst !== false}`);
    }

    // Dev Server Config
    config.push("");
    config.push("[dev]");
    config.push(`port = ${port}`);
    config.push(`ip = "0.0.0.0"`);

    return config.join("\n");
}

module.exports = { generateConfig, tomlKey, tomlString, tomlValue };
