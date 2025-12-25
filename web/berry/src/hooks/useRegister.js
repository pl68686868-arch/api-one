import { API } from 'utils/api';
import { useNavigate } from 'react-router';
import { showSuccess } from 'utils/common';

const useRegister = () => {
  const navigate = useNavigate();
  const register = async (input, turnstile) => {
    try {
      let affCode = localStorage.getItem('aff');
      if (affCode) {
        input = { ...input, aff_code: affCode };
      }
      const res = await API.post(`/api/user/register?turnstile=${turnstile}`, input);
      const { success, message } = res.data;
      if (success) {
        showSuccess('注册Success！');
        navigate('/login');
      }
      return { success, message };
    } catch (err) {
      // RequestFailed，SettingsError信息
      return { success: false, message: '' };
    }
  };

  const sendVerificationCode = async (email, turnstile) => {
    try {
      const res = await API.get(`/api/verification?email=${email}&turnstile=${turnstile}`);
      const { success, message } = res.data;
      if (success) {
        showSuccess('Verification code sent successfully, please check your email！');
      }
      return { success, message };
    } catch (err) {
      // RequestFailed，SettingsError信息
      return { success: false, message: '' };
    }
  };

  return { register, sendVerificationCode };
};

export default useRegister;
