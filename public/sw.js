// =============================================================================
// DiBeliin Admin - Service Worker
// =============================================================================
// Cuma buat Web Push. Sengaja TIDAK ada handler `fetch`/cache: app-nya butuh
// data live (pesanan, job checkout), cache offline malah bikin admin baca
// angka basi.

self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { title: 'DiBeliin Admin', body: event.data ? event.data.text() : '' };
    }

    event.waitUntil(
        self.registration.showNotification(data.title || 'DiBeliin Admin', {
            body: data.body || '',
            icon: '/Logo DiBeliin Admin.png',
            badge: '/Logo DiBeliin Admin.png',
            // tag sama = notif lama ditimpa, bukan numpuk (mis. satu job checkout
            // yang statusnya jalan terus). renotify biar tetap bergetar.
            tag: data.tag || undefined,
            renotify: Boolean(data.tag),
            data: { url: data.url || '/' },
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = (event.notification.data && event.notification.data.url) || '/';

    event.waitUntil((async () => {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clients) {
            if ('focus' in client) {
                await client.focus();
                if ('navigate' in client) await client.navigate(target);
                return;
            }
        }
        await self.clients.openWindow(target);
    })());
});
