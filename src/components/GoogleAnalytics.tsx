// =============================================================================
// Google Analytics 4 - Automatic Pageview Tracker
// =============================================================================
// Tracks route changes via react-router-dom's useLocation hook.
// Place this component inside <BrowserRouter> to enable automatic tracking.

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ReactGA from 'react-ga4';

export default function GoogleAnalytics() {
    const location = useLocation();

    useEffect(() => {
        ReactGA.send({
            hitType: 'pageview',
            page: location.pathname + location.search,
        });
    }, [location]);

    return null;
}
