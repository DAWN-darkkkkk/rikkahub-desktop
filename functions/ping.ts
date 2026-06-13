export const onRequest = async (context) => {
  return new Response("pong", {
    headers: { "Content-Type": "text/plain" },
  });
};
