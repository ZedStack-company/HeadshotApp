export function validateRequest(schema) {
  return async (req) => {
    try {
      const body = await req.json();
      const validated = await schema.validate(body, { abortEarly: false });
      return { valid: true, data: validated };
    } catch (error) {
      return {
        valid: false,
        errors: error.inner.map(err => ({
          path: err.path,
          message: err.message
        }))
      };
    }
  };
}

export const schemas = {
  headshotGeneration: {
    userId: (value) => {
      if (!value) return 'User ID is required';
      if (typeof value !== 'string') return 'User ID must be a string';
      return null;
    },
    image: (value) => {
      if (!value) return 'Image is required';
      if (!value.startsWith('data:image/')) return 'Image must be a valid base64 string';
      return null;
    },
    // Add other validation rules as needed
  }
};

export function validateSchema(schema, data) {
  const errors = [];
  for (const [key, validate] of Object.entries(schema)) {
    const error = validate(data[key]);
    if (error) {
      errors.push({ path: key, message: error });
    }
  }
  return errors.length ? { valid: false, errors } : { valid: true, data };
}
