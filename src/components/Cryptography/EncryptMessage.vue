<template>
  <div class="modal-card" @dragenter="dragenter" @dragleave="dragleave">
    <header class="modal-card-head">
      <p class="modal-card-title">Encrypt Message</p>
      <button type="button" class="delete" @click="close()"></button>
    </header>
    <section class="modal-card-body">
      <b-tabs position="is-centered" expanded v-if="!result">
        <b-tab-item label="Single Message">
          <template v-if="!result">
            <b-field label="Encrypt with Profile" :message="'Public Key: ' + pubKeyText">
              <b-dropdown v-model="selectedDid">
                <template #trigger>
                  <b-button :label="selectedDid ? selectedDid.name : $t('moveNft.ui.label.selectDid')" icon-right="menu-down" />
                  <p class="has-text-danger is-size-7" v-if="!selectedDid">{{ $t("moveNft.ui.label.selectDid") }}</p>
                </template>
                <b-dropdown-item v-for="did in dids" :key="did.did" :value="did">{{ did.name }}</b-dropdown-item>
              </b-dropdown>
            </b-field>
            <b-field label="Receiver Public Key">
              <b-input v-model="recPubKey" type="text"></b-input>
            </b-field>
            <b-field label="Message">
              <b-input v-model="message" type="textarea"></b-input>
            </b-field>
          </template>
        </b-tab-item>
        <b-tab-item label="Multiple Messages">
          <template v-if="!result">
            <b-field label="Encrypt with Profile" :message="'Public Key: ' + pubKeyText">
              <b-dropdown v-model="selectedDid">
                <template #trigger>
                  <b-button :label="selectedDid ? selectedDid.name : $t('moveNft.ui.label.selectDid')" icon-right="menu-down" />
                  <p class="has-text-danger is-size-7" v-if="!selectedDid">{{ $t("moveNft.ui.label.selectDid") }}</p>
                </template>

                <b-dropdown-item v-for="did in dids" :key="did.did" :value="did">{{ did.name }}</b-dropdown-item>
              </b-dropdown>
            </b-field>

            <span class="label">
              <b-tooltip :label="$t('batchSend.ui.tooltip.upload')" position="is-right">
                <b-upload v-model="file" accept=".csv" class="file-label" @input="afterUploadCsv">
                  <b-tag icon="tray-arrow-up" size="is-small">{{ $t("batchSend.ui.button.upload") }}</b-tag>
                </b-upload>
              </b-tooltip>
              <b-tooltip :label="$t('batchSend.ui.tooltip.help')" position="is-bottom" multilined>
                <b-icon icon="help-circle" size="is-small"> </b-icon>
              </b-tooltip>
              <a @click="fillSample"
                ><span class="is-size-7 is-underlined">{{ $t("batchSend.ui.field.csv.fillSample") }}</span></a
              >
              <span class="is-size-7">{{ $t("batchSend.ui.field.csv.or") }}</span>
              <a :href="csvSampleUri" :download="$t('batchSend.ui.field.csv.sampleName') + '.csv'"
                ><span class="is-size-7 is-underlined">{{ $t("batchSend.ui.field.csv.downloadSample") }}</span></a
              >
            </span>
            <b-field>
              <b-input type="textarea" v-model="csv" v-show="!isDragging"></b-input>
            </b-field>
            <b-field v-show="isDragging">
              <b-upload v-model="dragfile" drag-drop expanded multiple @input="afterDragged">
                <section class="section">
                  <div class="content has-text-centered">
                    <p>
                      <b-icon icon="upload" size="is-large"> </b-icon>
                    </p>
                    <p>{{ $t("batchSend.ui.field.csv.drag") }}</p>
                  </div>
                </section>
              </b-upload>
            </b-field>
            <b-field>
              <b-tag v-if="file" icon="paperclip" size="is-small" closable aria-close-label="Close tag" @close="deleteFile">
                {{ file.name }}
              </b-tag>
            </b-field>
          </template>
        </b-tab-item>
      </b-tabs>
      <template v-if="result">
        <b-input type="textarea" v-model="result" rows="18"></b-input>
      </template>
    </section>
    <footer class="modal-card-foot is-block">
      <div>
        <b-button v-if="!result" :label="$t('common.button.cancel')" class="is-pulled-left" @click="cancel()"></b-button>
        <b-button v-if="result" :label="$t('common.button.back')" class="is-pulled-left" @click="back()"></b-button>
      </div>
      <div>
        <b-button
          label="Encrypt"
          v-if="!result"
          class="is-pulled-right"
          type="is-primary"
          @click="toEncrypt()"
          :loading="submitting"
          :disabled="submitting"
        ></b-button>
        <b-button
          :label="$t('common.button.copy')"
          v-if="result"
          type="is-primary"
          class="is-pulled-right"
          @click="copy()"
        ></b-button>
      </div>
    </footer>
    <b-loading :is-full-page="false" v-model="submitting"></b-loading>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Emit, Watch } from "vue-property-decorator";
import { AccountEntity } from "@/models/account";
import KeyBox from "@/components/Common/KeyBox.vue";
import { NotificationProgrammatic as Notification } from "buefy";
import { DidDetail, TokenPuzzleDetail } from "@/services/crypto/receive";
import puzzle from "@/services/crypto/puzzle";
import { csvToArray } from "@/services/util/csv";
import { xchSymbol } from "@/store/modules/network";
import store from "@/store";
import { prefix0x } from "@/services/coin/condition";
import utility from "@/services/crypto/utility";
import { CryptographyService, EcPrivateKey } from "@/services/crypto/encryption";
import { Bytes } from "clvm";
import { bech32m } from "@scure/base";

@Component({
  components: {
    KeyBox,
  },
})
export default class EncryptMessage extends Vue {
  @Prop() public account!: AccountEntity;

  public submitting = false;
  public fee = 0;
  public csv = "";
  public file: File | null = null;
  public dragfile: File[] = [];
  public isDragging = false;
  public transitioning = false;
  public result = "";
  public recPubKey = "";
  public message = "";

  public requests: TokenPuzzleDetail[] = [];
  public selectedDid: DidDetail | null = null;

  get dids(): DidDetail[] {
    return this.account.dids || [];
  }

  mounted(): void {
    if (!this.account.dids) {
      store.dispatch("refreshDids");
    }
  }

  reset(): void {
    this.csv = "";
    this.file = null;
    this.dragfile = [];
    this.recPubKey = "";
    this.message = "";
  }

  get path(): string {
    return this.$route.path;
  }

  get sk_hex(): string {
    if (!this.selectedDid) return "";
    const requests = this.account.addressPuzzles.find((_) => _.symbol == xchSymbol())?.puzzles;
    if (!requests) {
      return "";
    }
    const ph = prefix0x(this.selectedDid.hintPuzzle);
    const sk_arr = requests.find((_) => prefix0x(_.hash) == ph)?.privateKey?.serialize();
    if (!sk_arr) {
      return "";
    }

    const sk_hex = utility.toHexString(sk_arr);
    return sk_hex;
  }

  get pubKeyText(): string {
    const ecc = new CryptographyService();
    const sk = EcPrivateKey.parse(this.sk_hex);
    if (!sk) {
      return "";
    }
    const pubKey = ecc.getPublicKey(this.sk_hex).toHex();
    const pubKeyText = puzzle.getAddressFromPuzzleHash(pubKey, "curve25519");
    return pubKeyText;
  }

  @Watch("path")
  onPathChange(): void {
    this.close();
  }

  @Emit("close")
  close(): void {
    if (this.path.endsWith("encrypt-message")) this.$router.back();
    return;
  }

  back(): void {
    this.result = "";
    this.selectedDid = null;
    this.reset();
  }

  cancel(): void {
    this.$router.push("/home");
  }

  async toEncrypt(): Promise<void> {
    if (this.csv) {
      this.encrypt();
    } else {
      this.csv = `target1,${this.recPubKey},${this.message}`;
      this.encrypt();
    }
  }

  async encrypt(): Promise<void> {
    this.submitting = true;
    try {
      if (!this.pubKeyText) {
        this.submitting = false;
        return;
      }

      const sk = EcPrivateKey.parse(this.sk_hex);
      if (!sk) {
        this.submitting = false;
        return;
      }

      const ecc = new CryptographyService();
      const inputs = csvToArray(this.csv);

      let result = "";

      for (let i = 0; i < inputs.length; i++) {
        const pars = inputs[i];
        const comment = pars[0];
        const pktext = pars[1];
        const pk = Bytes.from(bech32m.decodeToBytes(pktext).bytes).hex();
        const msg = pars[2];

        const enc = await ecc.encrypt(msg, pk, sk);
        result += `------------------------------ ${comment} ------------------------------
Sender Public Key: ${this.pubKeyText}
Receiver Public Key: ${pktext}
Encrypted Message: ${enc}
`;
      }
      this.result = result;
    } catch (error) {
      Notification.open({
        message: this.$tc("batchSend.ui.messages.failedToSign") + error,
        type: "is-danger",
        autoClose: false,
      });
      console.warn(error);
      this.reset();
      this.submitting = false;
    }
    this.reset();
    this.submitting = false;
  }

  get csvSampleUri(): string {
    const dataPrefix = "data:text/csv;charset=utf-8";
    const content = `
${dataPrefix},target1,curve255191ty3e7p5lpklfmvuy73l3lkp2m4tj4460y9ygzggqj6wqakg24feqtfue8c,message1
target2,curve255191ty3e7p5lpklfmvuy73l3lkp2m4tj4460y9ygzggqj6wqakg24feqtfue8c,message2
`.trim();
    return encodeURI(content);
  }

  fillSample(): void {
    this.csv = `
target1,curve255191ty3e7p5lpklfmvuy73l3lkp2m4tj4460y9ygzggqj6wqakg24feqtfue8c,message1
target2,curve255191ty3e7p5lpklfmvuy73l3lkp2m4tj4460y9ygzggqj6wqakg24feqtfue8c,message2
`.trim();
  }

  async afterUploadCsv(f: File): Promise<void> {
    this.isDragging = false;
    const csvText = await f.text();
    const idx = csvText.search("\n");
    this.csv = csvText.substring(idx + 1);
  }

  deleteFile(): void {
    this.file = null;
    this.csv = "";
  }

  dragenter(event: Event): void {
    event.preventDefault();
    this.isDragging = true;
    this.transitioning = true;
    setTimeout(() => (this.transitioning = false), 1);
  }

  dragleave(event: Event): void {
    event.preventDefault();
    if (!this.transitioning) this.isDragging = false;
  }

  afterDragged(f: File[]): void {
    this.isDragging = false;
    if (f.length > 1) {
      Notification.open({
        message: this.$tc("batchSend.ui.messages.onlyOneFile"),
        type: "is-danger",
        autoClose: false,
      });
      this.dragfile = [];
      return;
    }
    if (f[0].type !== "text/csv") {
      Notification.open({
        message: this.$tc("batchSend.ui.messages.wrongFileType"),
        type: "is-danger",
        autoClose: false,
      });
      this.dragfile = [];
      return;
    }
    this.file = f[0];
    this.afterUploadCsv(f[0]);
    this.dragfile = [];
  }

  copy(): void {
    store.dispatch("copy", this.result);
  }
}
</script>

<style scoped lang="scss">
::v-deep textarea {
  font-size: 0.8em;
}
</style>
