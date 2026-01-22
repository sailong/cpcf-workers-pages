/**
 * Generates wrangler.toml content based on project config
 * @param {Object} project 
 * @param {Object} resources - { kv: [], d1: [] }
 */
function generateConfig(project, resources = { kv: [], d1: [] }) {
    const { name, type, mainFile, bindings, port, envVars } = project;

    // Basic Config
    let config = [
        `name = "${name}"`,
        `compatibility_date = "2024-09-23"`,
        `compatibility_flags = ["nodejs_compat"]`
    ];

    if (type === 'worker') {
        config.push(`main = "${mainFile}"`);
    } else if (type === 'pages') {
        config.push(`pages_build_output_dir = "./"`);
    }

    // Bindings - KV
    if (bindings && bindings.kv && bindings.kv.length > 0) {
        bindings.kv.forEach(binding => {
            const kvResource = resources.kv.find(r => r.id === binding.resourceId);
            if (kvResource) {
                config.push("");
                config.push("[[kv_namespaces]]");
                config.push(`binding = "${binding.varName}"`);
                config.push(`id = "${kvResource.id}"`);
            }
        });
    }

    // Bindings - D1
    if (bindings && bindings.d1 && bindings.d1.length > 0) {
        bindings.d1.forEach(binding => {
            const d1Resource = resources.d1.find(r => r.id === binding.resourceId);
            if (d1Resource) {
                config.push("");
                config.push("[[d1_databases]]");
                config.push(`binding = "${binding.varName}"`);
                config.push(`database_name = "${d1Resource.name}"`);
                config.push(`database_id = "${d1Resource.id}"`);
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
                    config.push(`${key} = "${varData.value}"`);
                } else if (varData.type === 'json') {
                    // JSON 对象
                    const jsonValue = typeof varData.value === 'string'
                        ? varData.value
                        : JSON.stringify(varData.value);
                    config.push(`${key} = ${jsonValue}`);
                }
            });
        }

        // 加密变量（secret）
        const secrets = Object.entries(envVars).filter(([_, v]) => v.type === 'secret');
        if (secrets.length > 0) {
            secrets.forEach(([key, varData]) => {
                config.push("");
                config.push("[[unsafe.bindings]]");
                config.push(`name = "${key}"`);
                config.push(`type = "secret_text"`);
                config.push(`text = "${varData.value}"`);
            });
        }
    }

    // Dev Server Config
    config.push("");
    config.push("[dev]");
    config.push(`port = ${port}`);
    config.push(`ip = "0.0.0.0"`);

    return config.join("\n");
}

module.exports = { generateConfig };
