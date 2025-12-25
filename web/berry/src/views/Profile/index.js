import { useState, useEffect } from 'react';
import UserCard from 'ui-component/cards/UserCard';
import {
  Card,
  Button,
  InputLabel,
  FormControl,
  OutlinedInput,
  Stack,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  SvgIcon
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import SubCard from 'ui-component/cards/SubCard';
import { IconBrandWechat, IconBrandGithub, IconMail } from '@tabler/icons-react';
import Label from 'ui-component/Label';
import { API } from 'utils/api';
import { onOidcClicked, showError, showSuccess } from 'utils/common';
import { onGitHubOAuthClicked, onLarkOAuthClicked, copy } from 'utils/common';
import * as Yup from 'yup';
import WechatModal from 'views/Authentication/AuthForms/WechatModal';
import { useSelector } from 'react-redux';
import EmailModal from './component/EmailModal';
import Turnstile from 'react-turnstile';
import { ReactComponent as Lark } from 'assets/images/icons/lark.svg';
import { ReactComponent as OIDC } from 'assets/images/icons/oidc.svg';

const validationSchema = Yup.object().shape({
  username: Yup.string().required('Username cannot be empty').min(3, 'Username must be at least 3 characters'),
  display_name: Yup.string(),
  password: Yup.string().test('password', 'Password must be at least 8 characters', (val) => {
    return !val || val.length >= 8;
  })
});

export default function Profile() {
  const [inputs, setInputs] = useState([]);
  const [showAccountDeleteModal, setShowAccountDeleteModal] = useState(false);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [openWechat, setOpenWechat] = useState(false);
  const [openEmail, setOpenEmail] = useState(false);
  const status = useSelector((state) => state.siteInfo);

  const handleWechatOpen = () => {
    setOpenWechat(true);
  };

  const handleWechatClose = () => {
    setOpenWechat(false);
  };

  const handleInputChange = (event) => {
    let { name, value } = event.target;
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  };

  const loadUser = async () => {
    let res = await API.get(`/api/user/self`);
    const { success, message, data } = res.data;
    if (success) {
      setInputs(data);
    } else {
      showError(message);
    }
  };

  const bindWeChat = async (code) => {
    if (code === '') return;
    try {
      const res = await API.get(`/api/oauth/wechat/bind?code=${code}`);
      const { success, message } = res.data;
      if (success) {
        showSuccess('WeChat account bound successfully！');
      }
      return { success, message };
    } catch (err) {
      // RequestFailed，SettingsError信息
      return { success: false, message: '' };
    }
  };

  const generateAccessToken = async () => {
    const res = await API.get('/api/user/token');
    const { success, message, data } = res.data;
    if (success) {
      setInputs((inputs) => ({ ...inputs, access_token: data }));
      copy(data, '访问Token');
    } else {
      showError(message);
    }

    console.log(turnstileEnabled, turnstileSiteKey, status);
  };

  const submit = async () => {
    try {
      await validationSchema.validate(inputs);
      const res = await API.put(`/api/user/self`, inputs);
      const { success, message } = res.data;
      if (success) {
        showSuccess('User信息updated successfully！');
      } else {
        showError(message);
      }
    } catch (err) {
      showError(err.message);
    }
  };

  useEffect(() => {
    if (status) {
      if (status.turnstile_check) {
        setTurnstileEnabled(true);
        setTurnstileSiteKey(status.turnstile_site_key);
      }
    }
    loadUser().then();
  }, [status]);

  function getOidcId(){
    if (!inputs.oidc_id) return '';
    let oidc_id = inputs.oidc_id;
    if (inputs.oidc_id.length > 8) {
      oidc_id = inputs.oidc_id.slice(0, 6) + '...' + inputs.oidc_id.slice(-6);
    }
    return oidc_id;
  }

  return (
    <>
      <UserCard>
        <Card sx={{ paddingTop: '20px' }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={2} sx={{ paddingBottom: '20px' }}>
              <Label variant="ghost" color={inputs.wechat_id ? 'primary' : 'default'}>
                <IconBrandWechat /> {inputs.wechat_id || 'Unbound'}
              </Label>
              <Label variant="ghost" color={inputs.github_id ? 'primary' : 'default'}>
                <IconBrandGithub /> {inputs.github_id || 'Unbound'}
              </Label>
              <Label variant="ghost" color={inputs.email ? 'primary' : 'default'}>
                <IconMail /> {inputs.email || 'Unbound'}
              </Label>
              <Label variant="ghost" color={inputs.lark_id ? 'primary' : 'default'}>
                <SvgIcon component={Lark} inheritViewBox="0 0 24 24" /> {inputs.lark_id || 'Unbound'}
              </Label>
              <Label variant="ghost" color={inputs.oidc_id ? 'primary' : 'default'}>
                <SvgIcon component={OIDC} inheritViewBox="0 0 24 24" /> {getOidcId() || 'Unbound'}
              </Label>
            </Stack>
            <SubCard title="Profile信息">
              <Grid container spacing={2}>
                <Grid xs={12}>
                  <FormControl fullWidth variant="outlined">
                    <InputLabel htmlFor="username">User名</InputLabel>
                    <OutlinedInput
                      id="username"
                      label="User名"
                      type="text"
                      value={inputs.username || ''}
                      onChange={handleInputChange}
                      name="username"
                      placeholder="Please enterUser名"
                    />
                  </FormControl>
                </Grid>
                <Grid xs={12}>
                  <FormControl fullWidth variant="outlined">
                    <InputLabel htmlFor="password">Password</InputLabel>
                    <OutlinedInput
                      id="password"
                      label="Password"
                      type="password"
                      value={inputs.password || ''}
                      onChange={handleInputChange}
                      name="password"
                      placeholder="Please enterPassword"
                    />
                  </FormControl>
                </Grid>
                <Grid xs={12}>
                  <FormControl fullWidth variant="outlined">
                    <InputLabel htmlFor="display_name">显示Name</InputLabel>
                    <OutlinedInput
                      id="display_name"
                      label="显示Name"
                      type="text"
                      value={inputs.display_name || ''}
                      onChange={handleInputChange}
                      name="display_name"
                      placeholder="Please enter显示Name"
                    />
                  </FormControl>
                </Grid>
                <Grid xs={12}>
                  <Button variant="contained" color="primary" onClick={submit}>
                    Submit
                  </Button>
                </Grid>
              </Grid>
            </SubCard>
            <SubCard title="Account binding">
              <Grid container spacing={2}>
                {status.wechat_login && !inputs.wechat_id && (
                  <Grid xs={12} md={4}>
                    <Button variant="contained" onClick={handleWechatOpen}>
                      Bind WeChat account
                    </Button>
                  </Grid>
                )}
                {status.github_oauth && !inputs.github_id && (
                  <Grid xs={12} md={4}>
                    <Button variant="contained" onClick={() => onGitHubOAuthClicked(status.github_client_id, true)}>
                      绑定 GitHub 账号
                    </Button>
                  </Grid>
                )}
                {status.lark_client_id && !inputs.lark_id && (
                  <Grid xs={12} md={4}>
                    <Button variant="contained" onClick={() => onLarkOAuthClicked(status.lark_client_id)}>
                      绑定 飞书 账号
                    </Button>
                  </Grid>
                )}
                {status.oidc && !inputs.oidc_id && (
                  <Grid xs={12} md={4}>
                    <Button variant="contained" onClick={() => onOidcClicked(status.oidc_authorization_endpoint,status.oidc_client_id,true)}>
                      绑定 OIDC 账号
                    </Button>
                  </Grid>
                )}
                <Grid xs={12} md={4}>
                  <Button
                    variant="contained"
                    onClick={() => {
                      setOpenEmail(true);
                    }}
                  >
                    {inputs.email ? 'Change email' : 'Bind email'}
                  </Button>
                  {turnstileEnabled ? (
                    <Turnstile
                      sitekey={turnstileSiteKey}
                      onVerify={(token) => {
                        setTurnstileToken(token);
                      }}
                    />
                  ) : (
                    <></>
                  )}
                </Grid>
              </Grid>
            </SubCard>
            <SubCard title="其他">
              <Grid container spacing={2}>
                <Grid xs={12}>
                  <Alert severity="info">Note: Token generated here is for system management, not for requesting OpenAI services。</Alert>
                </Grid>
                {inputs.access_token && (
                  <Grid xs={12}>
                    <Alert severity="error">
                      Your access token is: <b>{inputs.access_token}</b> <br />
                      Please keep it safe. If leaked, reset immediately。
                    </Alert>
                  </Grid>
                )}
                <Grid xs={12}>
                  <Button variant="contained" onClick={generateAccessToken}>
                    {inputs.access_token ? 'Reset access token' : 'Generate access token'}
                  </Button>
                </Grid>

                <Grid xs={12}>
                  <Button
                    variant="contained"
                    color="error"
                    onClick={() => {
                      setShowAccountDeleteModal(true);
                    }}
                  >
                    Delete帐号
                  </Button>
                </Grid>
              </Grid>
            </SubCard>
          </Stack>
        </Card>
      </UserCard>
      <Dialog open={showAccountDeleteModal} onClose={() => setShowAccountDeleteModal(false)} maxWidth={'md'}>
        <DialogTitle sx={{ margin: '0px', fontWeight: 500, lineHeight: '1.55556', padding: '24px', fontSize: '1.125rem' }}>
          危险Action
        </DialogTitle>
        <Divider />
        <DialogContent>You are deleting your account, all data will be cleared and cannot be recovered</DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAccountDeleteModal(false)}>Cancel</Button>
          <Button
            sx={{ color: 'error.main' }}
            onClick={async () => {
              setShowAccountDeleteModal(false);
            }}
          >
            确定
          </Button>
        </DialogActions>
      </Dialog>
      <WechatModal open={openWechat} handleClose={handleWechatClose} wechatLogin={bindWeChat} qrCode={status.wechat_qrcode} />
      <EmailModal
        open={openEmail}
        turnstileToken={turnstileToken}
        handleClose={() => {
          setOpenEmail(false);
        }}
      />
    </>
  );
}
