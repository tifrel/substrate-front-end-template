// react imports
import React, { useState, useEffect } from "react";
import { Form, Input, Grid, Message } from "semantic-ui-react";

// substrate imports
import { useSubstrate } from "./substrate-lib";
import { TxButton } from "./substrate-lib/components";

// polkadot imports
import { blake2AsHex } from "@polkadot/util-crypto";

export function Main(props) {
  // Connection to  Substrate node
  const { api } = useSubstrate();
  // Get selected user from `AccountSelector component`
  const { accountPair } = props;

  // Create react hooks for state variables
  const [status, setStatus] = useState("");
  const [digest, setDigest] = useState("");
  const [owner, setOwner] = useState("");
  const [block, setBlock] = useState(0);

  // shared, mutable buffer to read a selected file
  let fileReader;
  // callback to hash file
  const bufferToDigest = () => {
    // convert file to hex string
    const content = Array.from(new Uint8Array(fileReader.result))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    // calculate hash and set state variable
    const hash = blake2AsHex(content, 256);
    setDigest(hash);
  };

  const handleFileChosen = (file) => {
    // replace previous buffer
    fileReader = new FileReader();
    // when all is loaded, calculate the hash
    fileReader.onloadend = bufferToDigest;
    // actually read the file
    fileReader.readAsArrayBuffer(file);
  };

  // React hook that updates block number and owner, second argument specifies
  // the update of the file digest or update of the storage as triggers
  useEffect(() => {
    // we need to hold a reference so we can return our unsubscribe callback
    let unsubscribe;

    // query `proofs` for `digest`, then use the result to update state variables
    api.query.templateModule
      .proofs(digest, (result) => {
        setOwner(result[0].toString());
        setBlock(result[1].toNumber());
      })
      .then((unsub) => {
        unsubscribe = unsub;
      });

    return () => unsubscribe && unsubscribe();
  }, [digest, api.query.templateModule]);

  function isClaimed() {
    return block !== 0;
  }

  return (
    <Grid.Column>
      <h1>Proof Of Existence</h1>
      {/* succes message or warning, depending on claim status */}
      <Form success={!!digest && !isClaimed()} warning={isClaimed()}>
        <Form.Field>
          {/* File selector */}
          <Input
            type="file"
            id="file"
            label="Your File"
            onChange={(e) => handleFileChosen(e.target.files[0])}
          />
          {/* The actual success message */}
          <Message
            success
            header="File digest not yet claimed"
            content={digest}
          />
          {/* The actual warning */}
          <Message
            warning
            header="File digest already claimed"
            list={[digest, `Owner: ${owner}`, `Block: ${block}`]}
          />
        </Form.Field>
        {/* Interaction buttons */}
        <Form.Field>
          {/* Create claim */}
          <TxButton
            accountPair={accountPair}
            label={"Create Claim"}
            setStatus={setStatus}
            type="SIGNED-TX"
            disabled={isClaimed() || !digest}
            attrs={{
              palletRpc: "templateModule",
              callable: "createClaim",
              inputParams: [digest],
              paramFields: [true],
            }}
          />
          {/* Revoke claim */}
          <TxButton
            accountPair={accountPair}
            label={"Revoke Claim"}
            setStatus={setStatus}
            type="SIGNED-TX"
            disabled={!isClaimed() || owner !== accountPair.address}
            attrs={{
              palletRpc: "templateModule",
              callable: "revokeClaim",
              inputParams: [digest],
              paramFields: [true],
            }}
          />
        </Form.Field>
        {/* Status message */}
        <div style={{ overflowWrap: "break-word" }}>{status}</div>
      </Form>
    </Grid.Column>
  );
}

export default function TemplateModule(props) {
  const { api } = useSubstrate();
  return api.query.templateModule && api.query.templateModule.proofs ? (
    <Main {...props} />
  ) : null;
}
