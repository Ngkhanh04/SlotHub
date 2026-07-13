import React, { useCallback, useEffect, useState } from 'react';
import AppAlertModal from '../components/common/AppAlertModal';
import { appAlert, registerAppAlertHandlers } from '../utils/appAlert';

export function AppAlertProvider({ children }) {
  const [alertState, setAlertState] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const closeAlert = useCallback(() => setAlertState(null), []);

  useEffect(() => {
    registerAppAlertHandlers({
      show: (payload) => setAlertState(payload),
      showConfirm: (payload) => setConfirmState(payload),
    });

    const nativeAlert = window.alert.bind(window);
    window.alert = (message) => {
      appAlert(String(message ?? ''));
    };

    return () => {
      window.alert = nativeAlert;
      registerAppAlertHandlers({ show: null, showConfirm: null });
    };
  }, []);

  return (
    <>
      {children}
      {alertState && (
        <AppAlertModal
          {...alertState}
          mode="alert"
          onClose={() => {
            alertState.onClose?.();
            closeAlert();
          }}
        />
      )}
      {confirmState && (
        <AppAlertModal
          {...confirmState}
          mode="confirm"
          onConfirm={() => {
            confirmState.onConfirm?.();
            setConfirmState(null);
          }}
          onCancel={() => {
            confirmState.onCancel?.();
            setConfirmState(null);
          }}
        />
      )}
    </>
  );
}