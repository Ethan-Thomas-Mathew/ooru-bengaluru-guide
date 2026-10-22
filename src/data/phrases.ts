// Everyday Kannada for newcomers. `say` is how it sounds in English
// letters; the Kannada script is what you'd see on signs.

export interface Phrase {
  kannada: string
  say: string
  meaning: string
}

export const PHRASE_GROUPS: { title: string; phrases: Phrase[] }[] = [
  {
    title: 'Basics',
    phrases: [
      { kannada: 'ನಮಸ್ಕಾರ', say: 'Namaskaara', meaning: 'Hello' },
      { kannada: 'ಧನ್ಯವಾದಗಳು', say: 'Dhanyavaadagalu', meaning: 'Thank you' },
      { kannada: 'ಹೌದು / ಇಲ್ಲ', say: 'Houdu / Illa', meaning: 'Yes / No' },
      { kannada: 'ಸರಿ', say: 'Sari', meaning: 'Okay' },
      { kannada: 'ಗೊತ್ತಾಯ್ತು', say: 'Gottaaytu', meaning: 'Understood' },
      {
        kannada: 'ಕನ್ನಡ ಸ್ವಲ್ಪ ಸ್ವಲ್ಪ ಬರುತ್ತೆ',
        say: 'Kannada swalpa swalpa barutte',
        meaning: 'I know a little Kannada',
      },
    ],
  },
  {
    title: 'In an auto',
    phrases: [
      { kannada: 'ಮೀಟರ್ ಹಾಕಿ', say: 'Meter haaki', meaning: 'Please put the meter on' },
      { kannada: 'ನೇರ ಹೋಗಿ', say: 'Nera hogi', meaning: 'Go straight' },
      { kannada: 'ಬಲಕ್ಕೆ ತಿರುಗಿ', say: 'Balakke tirugi', meaning: 'Turn right' },
      { kannada: 'ಎಡಕ್ಕೆ ತಿರುಗಿ', say: 'Edakke tirugi', meaning: 'Turn left' },
      { kannada: 'ಇಲ್ಲಿ ನಿಲ್ಸಿ', say: 'Illi nilsi', meaning: 'Stop here' },
      { kannada: 'ಸ್ವಲ್ಪ ನಿಧಾನ', say: 'Swalpa nidhaana', meaning: 'A bit slower, please' },
    ],
  },
  {
    title: 'Shopping and food',
    phrases: [
      { kannada: 'ಇದು ಎಷ್ಟು?', say: 'Idu eshtu?', meaning: 'How much is this?' },
      { kannada: 'ಸ್ವಲ್ಪ ಕಡಿಮೆ ಮಾಡಿ', say: 'Swalpa kadime maadi', meaning: 'Reduce it a little, please' },
      { kannada: 'ಒಂದು ಕಾಫಿ ಕೊಡಿ', say: 'Ondu coffee kodi', meaning: 'One coffee, please' },
      { kannada: 'ನೀರು ಬೇಕು', say: 'Neeru beku', meaning: 'I need water' },
      { kannada: 'ಬಿಲ್ ಕೊಡಿ', say: 'Bill kodi', meaning: 'The bill, please' },
      { kannada: 'ತುಂಬಾ ಚೆನ್ನಾಗಿದೆ', say: 'Tumba chennaagide', meaning: 'It is very good' },
    ],
  },
  {
    title: 'Finding your way',
    phrases: [
      { kannada: 'ಎಲ್ಲಿ?', say: 'Elli?', meaning: 'Where?' },
      { kannada: 'ಬಸ್ ಸ್ಟಾಪ್ ಎಲ್ಲಿದೆ?', say: 'Bus stop ellide?', meaning: 'Where is the bus stop?' },
      { kannada: 'ಮೆಟ್ರೋ ಸ್ಟೇಷನ್ ಎಲ್ಲಿದೆ?', say: 'Metro station ellide?', meaning: 'Where is the metro station?' },
      { kannada: 'ಎಷ್ಟು ದೂರ?', say: 'Eshtu doora?', meaning: 'How far is it?' },
      { kannada: 'ಗೊತ್ತಿಲ್ಲ', say: 'Gottilla', meaning: "I don't know" },
      {
        kannada: 'ಸ್ವಲ್ಪ ಅಡ್ಜಸ್ಟ್ ಮಾಡಿ',
        say: 'Swalpa adjust maadi',
        meaning: 'Please adjust a little (the city motto)',
      },
    ],
  },
]
