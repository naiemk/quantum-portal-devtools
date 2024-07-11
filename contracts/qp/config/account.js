
const TEST_MNEMONICS =
    "body sound phone helmet train more almost piano motor define basic retire play detect force ten bamboo swift among cinnamon humor earn coyote adjust";

module.exports = {
  accounts: process.env.TEST_ACCOUNT_PRIVATE_KEY ? [process.env.TEST_ACCOUNT_PRIVATE_KEY] : { mnemonic: TEST_MNEMONICS },
  mnemonics: TEST_MNEMONICS,
}
