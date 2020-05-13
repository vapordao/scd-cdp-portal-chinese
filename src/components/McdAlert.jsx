// Libraries
import React from "react";
import { observer } from "mobx-react";

// Components
import InlineNotification from "./InlineNotification";

@observer
class McdAlert extends React.Component {
  constructor(props){
    super(props);
    this.state = { show: true }
  }

  render() {
    return (
      this.state.show &&
      <InlineNotification
        class="mcd-alert"
        caption="多抵押 Dai 和 Oasis"
        message="单抵押 Dai (Sai) 已于 2020 年 5 月 12 日 UTC 时间 16 时正式关闭。现在开始，Sai 持有者和 CDP 持有者只能通过 MakerDAO 官方窗口 https://migrate.makerdao.com 赎回抵押资产。了解更多信息，请访问我们的论坛 https://forum.makerdao.com/ 或聊天室 https://chat.makerdao.com/home。"
        buttonText="前往赎回窗口"
        onCloseButtonClick={ () => { localStorage.setItem('ScdAlertClosed', true); this.setState({show: false}); } }
        onButtonClick={ () => window.open("https://migrate.makerdao.com", "_blank") }
      />
    )
  }
}

export default McdAlert;