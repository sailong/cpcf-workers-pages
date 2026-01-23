export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const action = url.pathname.replace(/^\//, ''); // remove leading slash
        const bucketName = url.searchParams.get('bucket');
        const key = url.searchParams.get('key');

        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        if (!bucketName) {
            return new Response('Bucket param required', { status: 400, headers: corsHeaders });
        }

        // Derive binding name from bucket ID (must match R2AdminManager logic)
        const bindingName = 'B_' + bucketName.replace(/[^a-zA-Z0-9_]/g, '_');
        const bucket = env[bindingName];

        if (!bucket) {
            return new Response(`Bucket binding '${bindingName}' (for id ${bucketName}) not found in worker`, { status: 404, headers: corsHeaders });
        }

        try {
            if (action === 'list') {
                const options = {};
                if (url.searchParams.get('cursor')) options.cursor = url.searchParams.get('cursor');
                if (url.searchParams.get('limit')) options.limit = parseInt(url.searchParams.get('limit'));
                if (url.searchParams.get('prefix')) options.prefix = url.searchParams.get('prefix');
                if (url.searchParams.get('delimiter')) options.delimiter = url.searchParams.get('delimiter');

                const listing = await bucket.list(options);
                return new Response(JSON.stringify(listing), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
            }

            if (action === 'get') {
                if (!key) return new Response('Key required', { status: 400, headers: corsHeaders });
                const object = await bucket.get(key);

                if (!object) {
                    return new Response('Object not found', { status: 404, headers: corsHeaders });
                }

                const headers = new Headers();
                object.writeHttpMetadata(headers);
                headers.set('etag', object.httpEtag);
                // Add CORS
                for (const [k, v] of Object.entries(corsHeaders)) {
                    headers.set(k, v);
                }

                return new Response(object.body, { headers });
            }

            if (action === 'put') {
                if (!key) return new Response('Key required', { status: 400, headers: corsHeaders });
                // We expect the body to be the file content
                // Check for custom metadata headers if needed, for now keep it simple
                const val = await bucket.put(key, request.body);
                return new Response(JSON.stringify(val), { status: 201, headers: corsHeaders });
            }

            if (action === 'delete') {
                if (!key) return new Response('Key required', { status: 400, headers: corsHeaders });
                await bucket.delete(key);
                return new Response('Deleted', { status: 200, headers: corsHeaders });
            }

        } catch (e) {
            return new Response(JSON.stringify({ error: e.message, stack: e.stack }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        return new Response('Invalid action: ' + action, { status: 400, headers: corsHeaders });
    }
}
