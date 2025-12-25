import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  OutlinedInput,
  Button,
  InputLabel,
  Grid,
  InputAdornment,
  FormControl,
  FormHelperText,
} from "@mui/material";
import { Formik } from "formik";
import { showError, showSuccess } from "utils/common";
import { useTheme } from "@mui/material/styles";
import * as Yup from "yup";
import useRegister from "hooks/useRegister";
import { API } from "utils/api";

const validationSchema = Yup.object().shape({
  email: Yup.string().email("Please enter a valid email address").required("Email cannot be empty"),
  email_verification_code: Yup.string().required("Verification code cannot be empty"),
});

const EmailModal = ({ open, handleClose, turnstileToken }) => {
  const theme = useTheme();
  const [countdown, setCountdown] = useState(30);
  const [disableButton, setDisableButton] = useState(false);
  const { sendVerificationCode } = useRegister();
  const [loading, setLoading] = useState(false);

  const submit = async (values, { setErrors, setStatus, setSubmitting }) => {
    setLoading(true);
    setSubmitting(true);
    const res = await API.get(
      `/api/oauth/email/bind?email=${values.email}&code=${values.email_verification_code}`
    );
    const { success, message } = res.data;
    if (success) {
      showSuccess("Email account bound successfully！");
      setSubmitting(false);
      setStatus({ success: true });
      handleClose();
    } else {
      showError(message);
      setErrors({ submit: message });
    }
    setLoading(false);
  };

  useEffect(() => {
    let countdownInterval = null;
    if (disableButton && countdown > 0) {
      countdownInterval = setInterval(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0) {
      setDisableButton(false);
      setCountdown(30);
    }
    return () => clearInterval(countdownInterval); // Clean up on unmount
  }, [disableButton, countdown]);

  const handleSendCode = async (email) => {
    setDisableButton(true);
    if (email === "") {
      showError("Please enter email");
      return;
    }
    if (turnstileToken === "") {
      showError("Please wait a few seconds, Turnstile is checking user environment！");
      return;
    }
    setLoading(true);
    const { success, message } = await sendVerificationCode(
      email,
      turnstileToken
    );
    setLoading(false);
    if (!success) {
      showError(message);
      return;
    }
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Bind email</DialogTitle>
      <DialogContent>
        <Grid container direction="column" alignItems="center">
          <Formik
            initialValues={{
              email: "",
              email_verification_code: "",
            }}
            enableReinitialize
            validationSchema={validationSchema}
            onSubmit={submit}
          >
            {({
              errors,
              touched,
              handleBlur,
              handleChange,
              handleSubmit,
              values,
            }) => (
              <form noValidate onSubmit={handleSubmit}>
                <FormControl
                  fullWidth
                  error={Boolean(touched.email && errors.email)}
                  sx={{ ...theme.typography.customInput }}
                >
                  <InputLabel htmlFor="email">Email</InputLabel>
                  <OutlinedInput
                    id="email"
                    type="text"
                    value={values.email}
                    name="email"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    endAdornment={
                      <InputAdornment position="end">
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() => handleSendCode(values.email)}
                          disabled={disableButton || loading}
                        >
                          {disableButton
                            ? `Resend(${countdown})`
                            : "Get verification code"}
                        </Button>
                      </InputAdornment>
                    }
                    inputProps={{}}
                  />
                  {touched.email && errors.email && (
                    <FormHelperText error id="helper-email">
                      {errors.email}
                    </FormHelperText>
                  )}
                </FormControl>
                <FormControl
                  fullWidth
                  error={Boolean(
                    touched.email_verification_code &&
                      errors.email_verification_code
                  )}
                  sx={{ ...theme.typography.customInput }}
                >
                  <InputLabel htmlFor="email_verification_code">
                    Verification code
                  </InputLabel>
                  <OutlinedInput
                    id="email_verification_code"
                    type="text"
                    value={values.email_verification_code}
                    name="email_verification_code"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    inputProps={{}}
                  />
                  {touched.email_verification_code &&
                    errors.email_verification_code && (
                      <FormHelperText error id="helper-email_verification_code">
                        {errors.email_verification_code}
                      </FormHelperText>
                    )}
                </FormControl>
                <DialogActions>
                  <Button onClick={handleClose}>Cancel</Button>
                  <Button
                    disableElevation
                    disabled={loading}
                    type="submit"
                    variant="contained"
                    color="primary"
                  >
                    Submit
                  </Button>
                </DialogActions>
              </form>
            )}
          </Formik>
        </Grid>
      </DialogContent>
    </Dialog>
  );
};

export default EmailModal;

EmailModal.propTypes = {
  open: PropTypes.bool,
  handleClose: PropTypes.func,
};
