import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SubCard from 'ui-component/cards/SubCard';
import {
  Stack,
  FormControl,
  InputLabel,
  OutlinedInput,
  Checkbox,
  Button,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Alert,
  Autocomplete,
  TextField
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import { showError, showSuccess, removeTrailingSlash } from 'utils/common'; //,
import { API } from 'utils/api';
import { createFilterOptions } from '@mui/material/Autocomplete';

const filter = createFilterOptions();
const SystemSetting = () => {
  const { t } = useTranslation();
  let [inputs, setInputs] = useState({
    PasswordLoginEnabled: '',
    PasswordRegisterEnabled: '',
    EmailVerificationEnabled: '',
    GitHubOAuthEnabled: '',
    GitHubClientId: '',
    GitHubClientSecret: '',
    LarkClientId: '',
    LarkClientSecret: '',
    OidcEnabled: '',
    OidcWellKnown: '',
    OidcClientId: '',
    OidcClientSecret: '',
    OidcAuthorizationEndpoint: '',
    OidcTokenEndpoint: '',
    OidcUserinfoEndpoint: '',
    Notice: '',
    SMTPServer: '',
    SMTPPort: '',
    SMTPAccount: '',
    SMTPFrom: '',
    SMTPToken: '',
    ServerAddress: '',
    Footer: '',
    WeChatAuthEnabled: '',
    WeChatServerAddress: '',
    WeChatServerToken: '',
    WeChatAccountQRCodeImageURL: '',
    TurnstileCheckEnabled: '',
    TurnstileSiteKey: '',
    TurnstileSecretKey: '',
    RegisterEnabled: '',
    EmailDomainRestrictionEnabled: '',
    EmailDomainWhitelist: [],
    MessagePusherAddress: '',
    MessagePusherToken: ''
  });
  const [originInputs, setOriginInputs] = useState({});
  let [loading, setLoading] = useState(false);
  const [EmailDomainWhitelist, setEmailDomainWhitelist] = useState([]);
  const [showPasswordWarningModal, setShowPasswordWarningModal] = useState(false);

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        newInputs[item.key] = item.value;
      });
      setInputs({
        ...newInputs,
        EmailDomainWhitelist: newInputs.EmailDomainWhitelist.split(',')
      });
      setOriginInputs(newInputs);

      setEmailDomainWhitelist(newInputs.EmailDomainWhitelist.split(','));
    } else {
      showError(message);
    }
  };

  useEffect(() => {
    getOptions().then();
  }, []);

  const updateOption = async (key, value) => {
    setLoading(true);
    switch (key) {
      case 'PasswordLoginEnabled':
      case 'PasswordRegisterEnabled':
      case 'EmailVerificationEnabled':
      case 'GitHubOAuthEnabled':
      case 'WeChatAuthEnabled':
      case 'TurnstileCheckEnabled':
      case 'EmailDomainRestrictionEnabled':
      case 'RegisterEnabled':
      case 'OidcEnabled':
        value = inputs[key] === 'true' ? 'false' : 'true';
        break;
      default:
        break;
    }
    const res = await API.put('/api/option/', {
      key,
      value
    });
    const { success, message } = res.data;
    if (success) {
      if (key === 'EmailDomainWhitelist') {
        value = value.split(',');
      }
      setInputs((inputs) => ({
        ...inputs,
        [key]: value
      }));
      showSuccess('SettingsSuccess！');
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const handleInputChange = async (event) => {
    let { name, value } = event.target;

    if (name === 'PasswordLoginEnabled' && inputs[name] === 'true') {
      // block disabling password login
      setShowPasswordWarningModal(true);
      return;
    }
    if (
      name === 'Notice' ||
      name.startsWith('SMTP') ||
      name === 'ServerAddress' ||
      name === 'GitHubClientId' ||
      name === 'GitHubClientSecret' ||
      name === 'WeChatServerAddress' ||
      name === 'WeChatServerToken' ||
      name === 'WeChatAccountQRCodeImageURL' ||
      name === 'TurnstileSiteKey' ||
      name === 'TurnstileSecretKey' ||
      name === 'EmailDomainWhitelist' ||
      name === 'MessagePusherAddress' ||
      name === 'MessagePusherToken' ||
      name === 'LarkClientId' ||
      name === 'LarkClientSecret' ||
      name === 'OidcClientId' ||
      name === 'OidcClientSecret' ||
      name === 'OidcWellKnown' ||
      name === 'OidcAuthorizationEndpoint' ||
      name === 'OidcTokenEndpoint' ||
      name === 'OidcUserinfoEndpoint'
    ) {
      setInputs((inputs) => ({ ...inputs, [name]: value }));
    } else {
      await updateOption(name, value);
    }
  };

  const submitServerAddress = async () => {
    let ServerAddress = removeTrailingSlash(inputs.ServerAddress);
    await updateOption('ServerAddress', ServerAddress);
  };

  const submitSMTP = async () => {
    if (originInputs['SMTPServer'] !== inputs.SMTPServer) {
      await updateOption('SMTPServer', inputs.SMTPServer);
    }
    if (originInputs['SMTPAccount'] !== inputs.SMTPAccount) {
      await updateOption('SMTPAccount', inputs.SMTPAccount);
    }
    if (originInputs['SMTPFrom'] !== inputs.SMTPFrom) {
      await updateOption('SMTPFrom', inputs.SMTPFrom);
    }
    if (originInputs['SMTPPort'] !== inputs.SMTPPort && inputs.SMTPPort !== '') {
      await updateOption('SMTPPort', inputs.SMTPPort);
    }
    if (originInputs['SMTPToken'] !== inputs.SMTPToken && inputs.SMTPToken !== '') {
      await updateOption('SMTPToken', inputs.SMTPToken);
    }
  };

  const submitEmailDomainWhitelist = async () => {
    await updateOption('EmailDomainWhitelist', inputs.EmailDomainWhitelist.join(','));
  };

  const submitWeChat = async () => {
    if (originInputs['WeChatServerAddress'] !== inputs.WeChatServerAddress) {
      await updateOption('WeChatServerAddress', removeTrailingSlash(inputs.WeChatServerAddress));
    }
    if (originInputs['WeChatAccountQRCodeImageURL'] !== inputs.WeChatAccountQRCodeImageURL) {
      await updateOption('WeChatAccountQRCodeImageURL', inputs.WeChatAccountQRCodeImageURL);
    }
    if (originInputs['WeChatServerToken'] !== inputs.WeChatServerToken && inputs.WeChatServerToken !== '') {
      await updateOption('WeChatServerToken', inputs.WeChatServerToken);
    }
  };

  const submitGitHubOAuth = async () => {
    if (originInputs['GitHubClientId'] !== inputs.GitHubClientId) {
      await updateOption('GitHubClientId', inputs.GitHubClientId);
    }
    if (originInputs['GitHubClientSecret'] !== inputs.GitHubClientSecret && inputs.GitHubClientSecret !== '') {
      await updateOption('GitHubClientSecret', inputs.GitHubClientSecret);
    }
  };

  const submitTurnstile = async () => {
    if (originInputs['TurnstileSiteKey'] !== inputs.TurnstileSiteKey) {
      await updateOption('TurnstileSiteKey', inputs.TurnstileSiteKey);
    }
    if (originInputs['TurnstileSecretKey'] !== inputs.TurnstileSecretKey && inputs.TurnstileSecretKey !== '') {
      await updateOption('TurnstileSecretKey', inputs.TurnstileSecretKey);
    }
  };

  const submitMessagePusher = async () => {
    if (originInputs['MessagePusherAddress'] !== inputs.MessagePusherAddress) {
      await updateOption('MessagePusherAddress', removeTrailingSlash(inputs.MessagePusherAddress));
    }
    if (originInputs['MessagePusherToken'] !== inputs.MessagePusherToken && inputs.MessagePusherToken !== '') {
      await updateOption('MessagePusherToken', inputs.MessagePusherToken);
    }
  };

  const submitLarkOAuth = async () => {
    if (originInputs['LarkClientId'] !== inputs.LarkClientId) {
      await updateOption('LarkClientId', inputs.LarkClientId);
    }
    if (originInputs['LarkClientSecret'] !== inputs.LarkClientSecret && inputs.LarkClientSecret !== '') {
      await updateOption('LarkClientSecret', inputs.LarkClientSecret);
    }
  };

  const submitOidc = async () => {
    if (inputs.OidcWellKnown !== '') {
      if (!inputs.OidcWellKnown.startsWith('http://') && !inputs.OidcWellKnown.startsWith('https://')) {
        showError(t('setting.system.oidc.url_error'));
        return;
      }
      try {
        const res = await API.get(inputs.OidcWellKnown);
        inputs.OidcAuthorizationEndpoint = res.data['authorization_endpoint'];
        inputs.OidcTokenEndpoint = res.data['token_endpoint'];
        inputs.OidcUserinfoEndpoint = res.data['userinfo_endpoint'];
        showSuccess(t('setting.system.oidc.fetch_success'));
      } catch (err) {
        showError(t('setting.system.oidc.fetch_failed'));
      }
    }

    if (originInputs['OidcWellKnown'] !== inputs.OidcWellKnown) {
      await updateOption('OidcWellKnown', inputs.OidcWellKnown);
    }
    if (originInputs['OidcClientId'] !== inputs.OidcClientId) {
      await updateOption('OidcClientId', inputs.OidcClientId);
    }
    if (originInputs['OidcClientSecret'] !== inputs.OidcClientSecret && inputs.OidcClientSecret !== '') {
      await updateOption('OidcClientSecret', inputs.OidcClientSecret);
    }
    if (originInputs['OidcAuthorizationEndpoint'] !== inputs.OidcAuthorizationEndpoint) {
      await updateOption('OidcAuthorizationEndpoint', inputs.OidcAuthorizationEndpoint);
    }
    if (originInputs['OidcTokenEndpoint'] !== inputs.OidcTokenEndpoint) {
      await updateOption('OidcTokenEndpoint', inputs.OidcTokenEndpoint);
    }
    if (originInputs['OidcUserinfoEndpoint'] !== inputs.OidcUserinfoEndpoint) {
      await updateOption('OidcUserinfoEndpoint', inputs.OidcUserinfoEndpoint);
    }
  };

  return (
    <>
      <Stack spacing={2}>
        <SubCard title="General settings">
          <Grid container spacing={{ xs: 3, sm: 2, md: 4 }}>
            <Grid xs={12}>
              <FormControl fullWidth>
                <InputLabel htmlFor="ServerAddress">{t('setting.system.general.server_address')}</InputLabel>
                <OutlinedInput
                  id="ServerAddress"
                  name="ServerAddress"
                  value={inputs.ServerAddress || ''}
                  onChange={handleInputChange}
                  label={t('setting.system.general.server_address')}
                  placeholder="例如：https://yourdomain.com"
                  disabled={loading}
                />
              </FormControl>
            </Grid>
            <Grid xs={12}>
              <Button variant="contained" onClick={submitServerAddress}>
                {t('setting.system.general.buttons.update')}
              </Button>
            </Grid>
          </Grid>
        </SubCard>
        <SubCard title={t('setting.system.login.title')}>
          <Grid container spacing={{ xs: 3, sm: 2, md: 4 }}>
            <Grid xs={12} md={3}>
              <FormControlLabel
                label={t('setting.system.login.password_login')}
                control={
                  <Checkbox checked={inputs.PasswordLoginEnabled === 'true'} onChange={handleInputChange} name="PasswordLoginEnabled" />
                }
              />
            </Grid>
            <Grid xs={12} md={3}>
              <FormControlLabel
                label={t('setting.system.login.password_register')}
                control={
                  <Checkbox
                    checked={inputs.PasswordRegisterEnabled === 'true'}
                    onChange={handleInputChange}
                    name="PasswordRegisterEnabled"
                  />
                }
              />
            </Grid>
            <Grid xs={12} md={3}>
              <FormControlLabel
                label={t('setting.system.login.email_verification')}
                control={
                  <Checkbox
                    checked={inputs.EmailVerificationEnabled === 'true'}
                    onChange={handleInputChange}
                    name="EmailVerificationEnabled"
                  />
                }
              />
            </Grid>
            <Grid xs={12} md={3}>
              <FormControlLabel
                label={t('setting.system.login.github_oauth')}
                control={<Checkbox checked={inputs.GitHubOAuthEnabled === 'true'} onChange={handleInputChange} name="GitHubOAuthEnabled" />}
              />
            </Grid>
            <Grid xs={12} md={3}>
              <FormControlLabel
                label={t('setting.system.login.oidc_login')}
                control={<Checkbox checked={inputs.OidcEnabled === 'true'} onChange={handleInputChange} name="OidcEnabled" />}
              />
            </Grid>
            <Grid xs={12} md={3}>
              <FormControlLabel
                label={t('setting.system.login.wechat_login')}
                control={<Checkbox checked={inputs.WeChatAuthEnabled === 'true'} onChange={handleInputChange} name="WeChatAuthEnabled" />}
              />
            </Grid>
            <Grid xs={12} md={3}>
              <FormControlLabel
                label={t('setting.system.login.registration')}
                control={<Checkbox checked={inputs.RegisterEnabled === 'true'} onChange={handleInputChange} name="RegisterEnabled" />}
              />
            </Grid>
            <Grid xs={12} md={3}>
              <FormControlLabel
                label={t('setting.system.login.turnstile')}
                control={
                  <Checkbox checked={inputs.TurnstileCheckEnabled === 'true'} onChange={handleInputChange} name="TurnstileCheckEnabled" />
                }
              />
            </Grid>
          </Grid>
        </SubCard>
        <SubCard title={t('setting.system.email_restriction.title')} subTitle={t('setting.system.email_restriction.subtitle')}>
          <Grid container spacing={{ xs: 3, sm: 2, md: 4 }}>
            <Grid xs={12}>
              <FormControlLabel
                label={t('setting.system.email_restriction.enable')}
                control={
                  <Checkbox
                    checked={inputs.EmailDomainRestrictionEnabled === 'true'}
                    onChange={handleInputChange}
                    name="EmailDomainRestrictionEnabled"
                  />
                }
              />
            </Grid>
            <Grid xs={12}>
              <FormControl fullWidth>
                <Autocomplete
                  multiple
                  freeSolo
                  id="EmailDomainWhitelist"
                  options={EmailDomainWhitelist}
                  value={inputs.EmailDomainWhitelist}
                  onChange={(e, value) => {
                    const event = {
                      target: {
                        name: 'EmailDomainWhitelist',
                        value: value
                      }
                    };
                    handleInputChange(event);
                  }}
                  filterSelectedOptions
                  renderInput={(params) => <TextField {...params} name="EmailDomainWhitelist" label={t('setting.system.email_restriction.allowed_domains')} />}
                  filterOptions={(options, params) => {
                    const filtered = filter(options, params);
                    const { inputValue } = params;
                    const isExisting = options.some((option) => inputValue === option);
                    if (inputValue !== '' && !isExisting) {
                      filtered.push(inputValue);
                    }
                    return filtered;
                  }}
                />
              </FormControl>
            </Grid>
            <Grid xs={12}>
              <Button variant="contained" onClick={submitEmailDomainWhitelist}>
                {t('setting.system.email_restriction.buttons.save')}
              </Button>
            </Grid>
          </Grid>
        </SubCard>
        <SubCard title={t('setting.system.smtp.title')} subTitle={t('setting.system.smtp.subtitle')}>
          <Grid container spacing={{ xs: 3, sm: 2, md: 4 }}>
            <Grid xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel htmlFor="SMTPServer">{t('setting.system.smtp.server')}</InputLabel>
                <OutlinedInput
                  id="SMTPServer"
                  name="SMTPServer"
                  value={inputs.SMTPServer || ''}
                  onChange={handleInputChange}
                  label={t('setting.system.smtp.server')}
                  placeholder="例如：smtp.qq.com"
                  disabled={loading}
                />
              </FormControl>
            </Grid>
            <Grid xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel htmlFor="SMTPPort">{t('setting.system.smtp.port')}</InputLabel>
                <OutlinedInput
                  id="SMTPPort"
                  name="SMTPPort"
                  value={inputs.SMTPPort || ''}
                  onChange={handleInputChange}
                  label={t('setting.system.smtp.port')}
                  placeholder="默认: 587"
                  disabled={loading}
                />
              </FormControl>
            </Grid>
            <Grid xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel htmlFor="SMTPAccount">{t('setting.system.smtp.account')}</InputLabel>
                <OutlinedInput
                  id="SMTPAccount"
                  name="SMTPAccount"
                  value={inputs.SMTPAccount || ''}
                  onChange={handleInputChange}
                  label={t('setting.system.smtp.account')}
                  placeholder="通常是邮箱地址"
                  disabled={loading}
                />
              </FormControl>
            </Grid>
            <Grid xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel htmlFor="SMTPFrom">{t('setting.system.smtp.from')}</InputLabel>
                <OutlinedInput
                  id="SMTPFrom"
                  name="SMTPFrom"
                  value={inputs.SMTPFrom || ''}
                  onChange={handleInputChange}
                  label={t('setting.system.smtp.from')}
                  placeholder="通常和邮箱地址保持一致"
                  disabled={loading}
                />
              </FormControl>
            </Grid>
            <Grid xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel htmlFor="SMTPToken">{t('setting.system.smtp.token')}</InputLabel>
                <OutlinedInput
                  id="SMTPToken"
                  name="SMTPToken"
                  value={inputs.SMTPToken || ''}
                  onChange={handleInputChange}
                  label={t('setting.system.smtp.token')}
                  placeholder="敏感信息不会发送到前端显示"
                  disabled={loading}
                />
              </FormControl>
            </Grid>
            <Grid xs={12}>
              <Button variant="contained" onClick={submitSMTP}>
                {t('setting.system.smtp.buttons.save')}
              </Button>
            </Grid>
          </Grid>
        </SubCard>
        <SubCard
          title={t('setting.system.github.title')}
          subTitle={
            <span>
              {' '}
              {t('setting.system.github.subtitle')}，
              <a href="https://github.com/settings/developers" target="_blank" rel="noopener noreferrer">
                点击此处
              </a>
              {t('setting.system.github.manage_text')}
            </span>
          }
        >
          <Grid container spacing={{ xs: 3, sm: 2, md: 4 }}>
            <Grid xs={12}>
              <Alert severity="info" sx={{ wordWrap: 'break-word' }}>
                Homepage URL 填 <b>{inputs.ServerAddress}</b>
                ，Authorization callback URL 填 <b>{`${inputs.ServerAddress}/oauth/github`}</b>
              </Alert>
            </Grid>
            <Grid xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel htmlFor="GitHubClientId">GitHub Client ID</InputLabel>
                <OutlinedInput
                  id="GitHubClientId"
                  name="GitHubClientId"
                  value={inputs.GitHubClientId || ''}
                  onChange={handleInputChange}
                  label="GitHub Client ID"
                  placeholder="输入你Register的 GitHub OAuth APP 的 ID"
                  disabled={loading}
                />
              </FormControl>
            </Grid>
            <Grid xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel htmlFor="GitHubClientSecret">GitHub Client Secret</InputLabel>
                <OutlinedInput
                  id="GitHubClientSecret"
                  name="GitHubClientSecret"
                  value={inputs.GitHubClientSecret || ''}
                  onChange={handleInputChange}
                  label="GitHub Client Secret"
                  placeholder="敏感信息不会发送到前端显示"
                  disabled={loading}
                />
              </FormControl>
            </Grid>
            <Grid xs={12}>
              <Button variant="contained" onClick={submitGitHubOAuth}>
                {t('setting.system.github.buttons.save')}
              </Button>
            </Grid>
          </Grid>
        </SubCard>
        <SubCard
          title={t('setting.system.lark.title')}
          subTitle={
            <span>
              {' '}
              {t('setting.system.lark.subtitle')}，
              <a href="https://open.feishu.cn/app" target="_blank" rel="noreferrer">
                点击此处
              </a>
              {t('setting.system.lark.manage_text')}
            </span>
          }
        >
          <Grid container spacing={{ xs: 3, sm: 2, md: 4 }}>
            <Grid xs={12}>
              <Alert severity="info" sx={{ wordWrap: 'break-word' }}>
                Home链接填 <code>{inputs.ServerAddress}</code>
                ，重定向 URL 填 <code>{`${inputs.ServerAddress}/oauth/lark`}</code>
              </Alert>
            </Grid>
            <Grid xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel htmlFor="LarkClientId">App ID</InputLabel>
                <OutlinedInput
                  id="LarkClientId"
                  name="LarkClientId"
                  value={inputs.LarkClientId || ''}
                  onChange={handleInputChange}
                  label="App ID"
                  placeholder="输入 App ID"
                  disabled={loading}
                />
              </FormControl>
            </Grid>
            <Grid xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel htmlFor="LarkClientSecret">App Secret</InputLabel>
                <OutlinedInput
                  id="LarkClientSecret"
                  name="LarkClientSecret"
                  value={inputs.LarkClientSecret || ''}
                  onChange={handleInputChange}
                  label="App Secret"
                  placeholder="敏感信息不会发送到前端显示"
                  disabled={loading}
                />
              </FormControl>
            </Grid>
            <Grid xs={12}>
              <Button variant="contained" onClick={submitLarkOAuth}>
                {t('setting.system.lark.buttons.save')}
              </Button>
            </Grid>
          </Grid>
        </SubCard>
        <SubCard
          title={t('setting.system.wechat.title')}
          subTitle={
            <span>
              {t('setting.system.wechat.subtitle')}，
              <a href="https://github.com/songquanpeng/wechat-server" target="_blank" rel="noopener noreferrer">
                点击此处
              </a>
              了解 WeChat Server
            </span>
          }
        >
          <Grid container spacing={{ xs: 3, sm: 2, md: 4 }}>
            <Grid xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel htmlFor="WeChatServerAddress">{t('setting.system.wechat.server_address')}</InputLabel>
                <OutlinedInput
                  id="WeChatServerAddress"
                  name="WeChatServerAddress"
                  value={inputs.WeChatServerAddress || ''}
                  onChange={handleInputChange}
                  label={t('setting.system.wechat.server_address')}
                  placeholder="例如：https://yourdomain.com"
                  disabled={loading}
                />
              </FormControl>
            </Grid>
            <Grid xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel htmlFor="WeChatServerToken">{t('setting.system.wechat.token')}</InputLabel>
                <OutlinedInput
                  id="WeChatServerToken"
                  name="WeChatServerToken"
                  value={inputs.WeChatServerToken || ''}
                  onChange={handleInputChange}
                  label={t('setting.system.wechat.token')}
                  placeholder="敏感信息不会发送到前端显示"
                  disabled={loading}
                />
              </FormControl>
            </Grid>
            <Grid xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel htmlFor="WeChatAccountQRCodeImageURL">{t('setting.system.wechat.qrcode')}</InputLabel>
                <OutlinedInput
                  id="WeChatAccountQRCodeImageURL"
                  name="WeChatAccountQRCodeImageURL"
                  value={inputs.WeChatAccountQRCodeImageURL || ''}
                  onChange={handleInputChange}
                  label={t('setting.system.wechat.qrcode')}
                  placeholder="输入一个图片链接"
                  disabled={loading}
                />
              </FormControl>
            </Grid>
            <Grid xs={12}>
              <Button variant="contained" onClick={submitWeChat}>
                {t('setting.system.wechat.buttons.save')}
              </Button>
            </Grid>
          </Grid>
        </SubCard>

        <SubCard
          title={t('setting.system.oidc.title')}
          subTitle={
            <span>
              {t('setting.system.oidc.subtitle')}
            </span>
          }
        >
          <Grid container spacing={{ xs: 3, sm: 2, md: 4 }}>
            <Grid xs={12} md={12}>
              <Alert severity="info" sx={{ wordWrap: 'break-word' }}>
                {t('setting.system.oidc.notice.url_info', { server_url: inputs.ServerAddress, callback_url: `${inputs.ServerAddress}/oauth/oidc` })}
              </Alert> <br />
              <Alert severity="info" sx={{ wordWrap: 'break-word' }}>
                {t('setting.system.oidc.notice.discovery')}
              </Alert>
            </Grid>
            <Grid xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel htmlFor="OidcClientId">Client ID</InputLabel>
                <OutlinedInput
                  id="OidcClientId"
                  name="OidcClientId"
                  value={inputs.OidcClientId || ''}
                  onChange={handleInputChange}
                  label="Client ID"
                  placeholder="输入 OIDC 的 Client ID"
                  disabled={loading}
                />
              </FormControl>
            </Grid>
            <Grid xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel htmlFor="OidcClientSecret">Client Secret</InputLabel>
                <OutlinedInput
                  id="OidcClientSecret"
                  name="OidcClientSecret"
                  value={inputs.OidcClientSecret || ''}
                  onChange={handleInputChange}
                  label="Client Secret"
                  placeholder="敏感信息不会发送到前端显示"
                  disabled={loading}
                />
              </FormControl>
            </Grid>
            <Grid xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel htmlFor="OidcWellKnown">Well-Known URL</InputLabel>
                <OutlinedInput
                  id="OidcWellKnown"
                  name="OidcWellKnown"
                  value={inputs.OidcWellKnown || ''}
                  onChange={handleInputChange}
                  label="Well-Known URL"
                  placeholder={t('setting.system.oidc.well_known_placeholder')}
                  disabled={loading}
                />
              </FormControl>
            </Grid>
            <Grid xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel htmlFor="OidcAuthorizationEndpoint">Authorization Endpoint</InputLabel>
                <OutlinedInput
                  id="OidcAuthorizationEndpoint"
                  name="OidcAuthorizationEndpoint"
                  value={inputs.OidcAuthorizationEndpoint || ''}
                  onChange={handleInputChange}
                  label="Authorization Endpoint"
                  placeholder="输入 OIDC 的 Authorization Endpoint"
                  disabled={loading}
                />
              </FormControl>
            </Grid>
            <Grid xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel htmlFor="OidcTokenEndpoint">Token Endpoint</InputLabel>
                <OutlinedInput
                  id="OidcTokenEndpoint"
                  name="OidcTokenEndpoint"
                  value={inputs.OidcTokenEndpoint || ''}
                  onChange={handleInputChange}
                  label="Token Endpoint"
                  placeholder="输入 OIDC 的 Token Endpoint"
                  disabled={loading}
                />
              </FormControl>
            </Grid>
            <Grid xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel htmlFor="OidcUserinfoEndpoint">Userinfo Endpoint</InputLabel>
                <OutlinedInput
                  id="OidcUserinfoEndpoint"
                  name="OidcUserinfoEndpoint"
                  value={inputs.OidcUserinfoEndpoint || ''}
                  onChange={handleInputChange}
                  label="Userinfo Endpoint"
                  placeholder="输入 OIDC 的 Userinfo Endpoint"
                  disabled={loading}
                />
              </FormControl>
            </Grid>
            <Grid xs={12}>
              <Button variant="contained" onClick={submitOidc}>
                {t('setting.system.oidc.buttons.save')}
              </Button>
            </Grid>
          </Grid>
        </SubCard>

        <SubCard
            <span>
          {t('setting.system.message_pusher.subtitle')}，
          <a href="https://github.com/songquanpeng/message-pusher" target="_blank" rel="noreferrer">
            点击此处
          </a>
          了解 Message Pusher
        </span>
          }
        >
        <Grid container spacing={{ xs: 3, sm: 2, md: 4 }}>
          <Grid xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel htmlFor="MessagePusherAddress">Message Pusher 推送地址</InputLabel>
              <OutlinedInput
                id="MessagePusherAddress"
                name="MessagePusherAddress"
                value={inputs.MessagePusherAddress || ''}
                onChange={handleInputChange}
                label="Message Pusher 推送地址"
                placeholder="例如：https://msgpusher.com/push/your_username"
                disabled={loading}
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel htmlFor="MessagePusherToken">Message Pusher 访问凭证</InputLabel>
              <OutlinedInput
                id="MessagePusherToken"
                name="MessagePusherToken"
                type="password"
                value={inputs.MessagePusherToken || ''}
                onChange={handleInputChange}
                label="Message Pusher 访问凭证"
                placeholder="敏感信息不会发送到前端显示"
                disabled={loading}
              />
            </FormControl>
          </Grid>
          <Grid xs={12}>
            <Button variant="contained" onClick={submitMessagePusher}>
              Save Message Pusher Settings
            </Button>
          </Grid>
        </Grid>
      </SubCard>
      <SubCard
        title="配置 Turnstile"
        subTitle={
          <span>
            用以支持User校验，
            <a href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer">
              点击此处
            </a>
            Management你的 Turnstile Sites，推荐选择 Invisible Widget Type
          </span>
        }
      >
        <Grid container spacing={{ xs: 3, sm: 2, md: 4 }}>
          <Grid xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel htmlFor="TurnstileSiteKey">Turnstile Site Key</InputLabel>
              <OutlinedInput
                id="TurnstileSiteKey"
                name="TurnstileSiteKey"
                value={inputs.TurnstileSiteKey || ''}
                onChange={handleInputChange}
                label="Turnstile Site Key"
                placeholder="输入你Register的 Turnstile Site Key"
                disabled={loading}
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel htmlFor="TurnstileSecretKey">Turnstile Secret Key</InputLabel>
              <OutlinedInput
                id="TurnstileSecretKey"
                name="TurnstileSecretKey"
                type="password"
                value={inputs.TurnstileSecretKey || ''}
                onChange={handleInputChange}
                label="Turnstile Secret Key"
                placeholder="敏感信息不会发送到前端显示"
                disabled={loading}
              />
            </FormControl>
          </Grid>
          <Grid xs={12}>
            <Button variant="contained" onClick={submitTurnstile}>
              Save Turnstile Settings
            </Button>
          </Grid>
        </Grid>
      </SubCard>
    </Stack >
      <Dialog open={showPasswordWarningModal} onClose={() => setShowPasswordWarningModal(false)} maxWidth={'md'}>
        <DialogTitle sx={{ margin: '0px', fontWeight: 700, lineHeight: '1.55556', padding: '24px', fontSize: '1.125rem' }}>
          Warning
        </DialogTitle>
        <Divider />
        <DialogContent>CancelPasswordLogin将导致所有Unbound其他Login方式的User（包括Management员）无法通过PasswordLogin，ConfirmCancel？</DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPasswordWarningModal(false)}>Cancel</Button>
          <Button
            sx={{ color: 'error.main' }}
            onClick={async () => {
              setShowPasswordWarningModal(false);
              await updateOption('PasswordLoginEnabled', 'false');
            }}
          >
            确定
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SystemSetting;
