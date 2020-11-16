import React, {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { Switch, Route, Redirect } from 'react-router-dom';
import { connect } from 'react-redux';
import PullToRefresh from 'pulltorefreshjs';
import { ErrorBoundary } from 'react-error-boundary';
import { userState } from './Store/Actions/Login';
import Loading from './Components/Animation/Loading';
import { ToastProvider } from 'react-toast-notifications';
import Content from './Components/Animation/Content';
import ErrorFallback from './Components/Animation/ErrorFallback';
import Header from './Components/Home/Header/Header';
import Toast from './Components/Utils/Toast';
import socket from './Components/Functions/Users';
import './Styles/AutoGenerated/main.css';
import { RecieveMessage } from './Store/Actions/Message';
import { IndicateChannel } from './Store/Actions/Peer';
import CallStatus from './Components/Utils/CallStatus';
import retry from './Components/Utils/Retry';

// retry is a function which will try for 5 times
// Need it because, sometimes chunk loading fails.
const Auth = lazy(() => retry(() => import('./Components/Auth/Login')));
const Home = lazy(() => retry(() => import('./Components/Home/Home')));
const About = lazy(() => retry(() => import('./Components/About/About')));
const Invite = lazy(() => retry(() => import('./Components/Invite/Invite')));
const Join = lazy(() => retry(() => import('./Components/Join/Join')));
const Settings = lazy(() =>
  retry(() => import('./Components/Settings/Settings')),
);
const Create = lazy(() => retry(() => import('./Components/Create/Create')));
const Logout = lazy(() => retry(() => import('./Components/Utils/Logout')));
const Channel = lazy(() => retry(() => import('./Components/Invite/Channel')));
const Room = lazy(() => retry(() => import('./Components/Channel/Channel')));
const Page404 = lazy(() => retry(() => import('./Components/404/FNF')));

function App({
  loginState,
  init,
  reciveFiles,
  recieveMessage,
  iChannel,
  callStatus,
}) {
  const [redirectTo, setRedirectTo] = useState();

  useEffect(() => {
    init();
  }, [init]);

  // To recieve background messages
  useEffect(() => {
    recieveMessage();
  }, [recieveMessage]);

  // Listen for navigator event from service worker
  useLayoutEffect(() => {
    const handleMessag = (event) => {
      if (event.data.url) {
        setRedirectTo(event.data.url);
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.onmessage = handleMessag;
    }
  }, [redirectTo]);

  // To indicate the current channel
  useEffect(() => {
    const uid = loginState.user?.uid || null;
    if (loginState.authenticated) {
      iChannel(false, uid, true);
    }
  }, [loginState, iChannel]);

  // To indicate that the user is authenticated
  useEffect(() => {
    const obj = {
      uid: loginState.user?.uid || null,
      displayName: loginState.user?.displayName || 'Anonymous',
      online: true,
    };

    if (loginState.authenticated) {
      socket.emit('authenticated', obj);
    }

    // listen for change event
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && loginState.authenticated) {
        socket.emit('authenticated', obj);
      }
    });
  }, [loginState, reciveFiles]);

  // pull-to-refresh
  useEffect(() => {
    PullToRefresh.init({
      mainElement: 'body',
      onRefresh() {
        window.location.reload();
      },
      shouldPullToRefresh() {
        return !window.location.pathname.includes('/r');
      },
    });

    return () => PullToRefresh.destroyAll();
  }, []);

  const { pathname: path, search } = window.location;
  const slug = path.split('/')[2];

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      {/* Wait for the AuthState */}

      {loginState.isLoginLoading && <Loading />}

      {/*  Check for Auth State and Redirect */}

      {!loginState.isLoginLoading &&
        !loginState.authenticated &&
        path.includes('/join') && <Redirect to={`/login?url=${path}`} />}

      {!loginState.isLoginLoading &&
        !loginState.authenticated &&
        !path.includes('/invite') &&
        !path.includes('/join') &&
        !search.includes('/join') && <Redirect to="/login" />}

      {!loginState.isLoginLoading &&
        loginState.authenticated &&
        path.includes('/invite') && <Redirect to={'/channel/' + slug} />}

      {redirectTo && !loginState.isLoginLoading && loginState.authenticated && (
        <Redirect to={redirectTo} />
      )}

      {/* Unauthenticated Route */}
      <Suspense fallback={<Content />}>
        <Switch>
          <Route path="/login" component={Auth} />
          <Route path="/invite/:id" component={Invite} />
        </Switch>
      </Suspense>

      <ToastProvider>
        <Toast />
      </ToastProvider>

      {callStatus && <CallStatus callStatus={callStatus} />}

      {/* Protected Routes */}

      {loginState.authenticated && (
        <div className="lg:grid lg:grid-cols-4 ">
          <Header />
          <Suspense fallback={<Content />}>
            <Switch>
              <Route exact path="/" component={Home} />
              <Route path="/r/:id" component={Room} />
              <Route path="/settings" component={Settings} />
              <Route path="/about" component={About} />
              <Route path="/create" component={Create} />
              <Route path="/join/:from" component={Join} />
              <Route path="/logout" component={Logout} />
              <Route path="/channel/:id" component={Channel} />
              <Route component={Page404} />
            </Switch>
          </Suspense>
        </div>
      )}
    </ErrorBoundary>
  );
}

const mapStateToProps = (state) => ({
  loginState: state.authReducer,
  callStatus: state.peerReducer.callStatus,
});

const mapDispatchToProps = (dispatch) => ({
  init: () => dispatch(userState()),
  recieveMessage: () => dispatch(RecieveMessage()),
  iChannel: (channel, uid, status) =>
    dispatch(IndicateChannel(channel, uid, status)),
});

export default connect(mapStateToProps, mapDispatchToProps)(App);
