export default {
  async fetch(request, env, ctx) {
    return new Response("EDITED: Changed via editor!");
  }
}